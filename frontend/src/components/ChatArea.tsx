import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ArrowUp,
  Paperclip,
  Menu,
  FileText,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react'
import MessageBubble from './MessageBubble'
import type { Message, Document } from '../types'

interface ChatAreaProps {
  messages: Message[]
  loading: boolean
  activeDoc: Document | null
  onSend: (question: string) => void
  onUpload: (file: File) => void
  onToggleSidebar: () => void
  dark: boolean
  onToggleTheme: () => void
}

export default function ChatArea({
  messages,
  loading,
  activeDoc,
  onSend,
  onUpload,
  onToggleSidebar,
  dark,
  onToggleTheme,
}: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setInput('')
    onSend(trimmed)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, loading, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const target = e.target
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.')
      setTimeout(() => setUploadError(null), 4000)
      return
    }
    setUploadError(null)
    onUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setUploadError('Only PDF files are supported.')
        setTimeout(() => setUploadError(null), 4000)
        return
      }
      setUploadError(null)
      onUpload(file)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div
      className="relative flex flex-1 flex-col h-full overflow-hidden bg-[#07080b] text-[#e6edf3]"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag Over Overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs pointer-events-none">
          <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-blue-500/40 bg-[#0f121a]">
            <Paperclip size={28} className="text-[#3b82f6] animate-bounce" />
            <p className="text-sm font-medium text-white">Drop PDF to upload and index</p>
          </div>
        </div>
      )}

      {/* Top Floating Bar: Minimalist Menu Button & Active Document Pill */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2 z-10">
        <div className="flex items-center gap-3">
          {/* Menu button [≡] as in user's screenshot */}
          <button
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#141822] hover:bg-[#1a202d] text-[#8c94a4] hover:text-white transition-colors cursor-pointer border border-white/[0.04]"
            aria-label="Toggle menu"
            title="Documents"
          >
            <Menu size={16} />
          </button>

          {activeDoc && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#12151e] border border-white/[0.05] text-xs text-[#8c94a4]">
              <FileText size={12} className="text-[#3b82f6]" />
              <span className="max-w-[200px] truncate text-[#c5cbd6]">
                {activeDoc.filename}
              </span>
              {activeDoc.pageCount > 0 && (
                <span className="text-[#555e6d]">· {activeDoc.pageCount}p</span>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#141822] hover:bg-[#1a202d] text-[#8c94a4] hover:text-white transition-colors cursor-pointer border border-white/[0.04]"
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-4">
        <div className="max-w-2xl sm:max-w-3xl mx-auto w-full min-h-full flex flex-col justify-end">
          {isEmpty ? (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center animate-fade-in space-y-4">
              <div className="h-10 w-10 rounded-full bg-[#141822] flex items-center justify-center text-[#3b82f6]">
                <FileText size={18} />
              </div>
              <p className="text-sm text-[#8c94a4] max-w-md leading-relaxed">
                {activeDoc
                  ? `Ask any question grounded in ${activeDoc.filename}. DocuMind retrieves verified facts with exact citations.`
                  : 'Upload a document using the attach button below to start asking questions with citations.'}
              </p>
              {activeDoc && (
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    'Summarize this document',
                    'What are the key conclusions?',
                    'List the main data and statistics',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => onSend(q)}
                      className="px-3.5 py-1.5 rounded-full bg-[#12151e] hover:bg-[#181d29] border border-white/[0.05] text-xs text-[#8c94a4] hover:text-white transition-all cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#8c94a4] py-2 animate-fade-in">
                  <div className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span>Searching document chunks and verifying answers...</span>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Bottom Chatbox */}
      <div className="w-full px-4 sm:px-6 md:px-12 pb-6 pt-2">
        <div className="max-w-2xl sm:max-w-3xl mx-auto w-full">
          {/* Upload Error Banner if any */}
          {uploadError && (
            <div className="flex items-center gap-2 mb-2 p-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-fade-in">
              <AlertCircle size={14} />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Active Upload / Indexing indicator badge if document is processing */}
          {activeDoc && activeDoc.step !== 'ready' && activeDoc.step !== 'error' && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-[#12151e] border border-blue-500/20 text-xs text-[#3b82f6] animate-fade-in">
              <Loader2 size={13} className="animate-spin" />
              <span>
                {activeDoc.filename}: {activeDoc.step}...
              </span>
            </div>
          )}

          {/* Sleek Floating Input Box */}
          <div className="relative flex items-end gap-2 p-2 pl-3 rounded-2xl bg-[#12151e] border border-white/[0.07] focus-within:border-white/20 transition-all shadow-lg">
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Document Upload Button inside the Chatbox */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#788294] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer mb-0.5"
              title="Upload PDF document"
              aria-label="Upload PDF document"
            >
              <Paperclip size={17} />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask about company policies, employees, or documentation..."
              className="flex-1 max-h-[160px] min-h-[36px] py-1.5 px-1 bg-transparent text-[14px] text-[#e2e8f0] placeholder-[#555d6c] resize-none outline-none leading-relaxed disabled:opacity-50"
            />

            {/* Send Button: [↑] ArrowUp icon matching screenshots */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-150 mb-0.5 ${
                input.trim() && !loading
                  ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb] cursor-pointer shadow-sm'
                  : 'bg-[#181d29] text-[#474f5e] cursor-not-allowed'
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <ArrowUp size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
