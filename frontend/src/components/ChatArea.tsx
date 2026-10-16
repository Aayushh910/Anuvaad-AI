import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  ArrowUp,
  Plus,
  Menu,
  FileText,
  Sun,
  Moon,
  ChevronDown,
  Upload,
  Check,
  RotateCcw,
} from 'lucide-react'
import MessageBubble from './MessageBubble'
import DocumentProcessingCard from './DocumentProcessingCard'
import type { Message, Document } from '../types'

interface ChatAreaProps {
  messages: Message[]
  loading: boolean
  activeDoc: Document | null
  documents: Document[]
  onSelectDoc: (id: string) => void
  onSend: (question: string) => void
  onUpload: (file: File) => void
  onOpenSidebar: () => void
  onNewChat: () => void
  dark: boolean
  onToggleTheme: () => void
}

export default function ChatArea({
  messages,
  loading,
  activeDoc,
  documents,
  onSelectDoc,
  onSend,
  onUpload,
  onOpenSidebar,
  onNewChat,
  dark,
  onToggleTheme,
}: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [docMenuOpen, setDocMenuOpen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(1)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const docDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        docDropdownRef.current &&
        !docDropdownRef.current.contains(e.target as Node)
      ) {
        setDocMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Timer for loading state
  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(1)
      return
    }
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [loading])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Context-aware dynamic thinking text depending on question content
  const dynamicThinkingStatus = useMemo(() => {
    const q = currentQuestion.toLowerCase()
    if (q.includes('summary') || q.includes('summarize') || q.includes('overview')) {
      return 'Synthesizing key insights from document...'
    }
    if (
      q.includes('table') ||
      q.includes('number') ||
      q.includes('stat') ||
      q.includes('data') ||
      q.includes('metric') ||
      q.includes('salary') ||
      q.includes('score')
    ) {
      return 'Analyzing tables and numerical records in document...'
    }
    if (
      q.includes('rule') ||
      q.includes('policy') ||
      q.includes('guideline') ||
      q.includes('process') ||
      q.includes('step')
    ) {
      return 'Checking procedure and policy context...'
    }
    if (q.includes('who') || q.includes('name') || q.includes('person') || q.includes('author')) {
      return 'Searching entity mentions and document records...'
    }
    return `Searching relevant passages in ${activeDoc ? activeDoc.filename : 'document'}...`
  }, [currentQuestion, activeDoc])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setCurrentQuestion(trimmed)
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
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
      e.target.value = ''
    }
  }

  const processingDoc = documents.find((d) => d.step !== 'ready' && d.step !== 'error')
  const isEmpty = messages.length === 0

  return (
    <div
      className="relative flex flex-1 flex-col h-full overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Navigation Bar: Minimal, Borderless */}
      <header className="flex items-center justify-between px-6 pt-4 pb-2 z-20 shrink-0">
        {/* Left: Menu Button only */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all cursor-pointer hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            title="Open documents sidebar"
            aria-label="Open documents sidebar"
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Right: New Chat button & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* New Chat Button shifted to right top */}
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer hover:opacity-85 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title="Start a new chat"
          >
            <RotateCcw size={13} className="text-[var(--text-blue)]" />
            <span>New Chat</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all cursor-pointer hover:scale-105 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark/light mode"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {isEmpty ? (
        /* Claude-style Centered Welcome & Input */
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 z-10 animate-fade-in -mt-12">
          {/* Claude Greeting Header */}
          <div className="flex items-center gap-3 mb-6 select-none">
            <span className="text-3xl text-[var(--text-coral)]">✳</span>
            <h1
              className="text-3xl sm:text-4xl font-normal font-serif-claude tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Back at it, Aayush
            </h1>
          </div>

          {/* Real-time Document Processing Card if any is uploading */}
          {processingDoc && (
            <div className="w-full max-w-2xl mb-4">
              <DocumentProcessingCard
                doc={processingDoc}
                onStartChatting={() => onSelectDoc(processingDoc.id)}
              />
            </div>
          )}

          {/* Centered Claude-style Chat Box */}
          <div className="w-full max-w-2xl">
            <div
              className="rounded-2xl border transition-all shadow-xl p-3 focus-within:ring-2 focus-within:ring-blue-500/20"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
              }}
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask about your documents..."
                className="w-full py-1 px-1 bg-transparent text-[15px] resize-none outline-none leading-relaxed font-sans"
                style={{
                  color: 'var(--text-primary)',
                }}
              />

              {/* Bottom Actions Row inside Input Box */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {/* + Button: Navigates to Document Sidebar */}
                  <button
                    onClick={onOpenSidebar}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer hover:opacity-85"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-secondary)',
                    }}
                    title="Upload or manage documents"
                  >
                    <Plus size={15} />
                  </button>

                  {/* Document Selector Shifted Directly Inside Chatbox */}
                  <div className="relative" ref={docDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDocMenuOpen(!docMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-85"
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <FileText size={12} className="text-[var(--text-blue)]" />
                      <span className="max-w-[140px] truncate">
                        {activeDoc ? activeDoc.filename : 'Select Document'}
                      </span>
                      <ChevronDown size={12} className="text-[var(--text-dim)]" />
                    </button>

                    {/* Document Dropdown inside Chatbox */}
                    {docMenuOpen && (
                      <div
                        className="absolute left-0 bottom-full mb-2 w-64 rounded-xl border p-1.5 shadow-2xl z-50 animate-fade-in"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-medium)',
                        }}
                      >
                        <div
                          className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Change Document
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-0.5 my-1">
                          {documents.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => {
                                onSelectDoc(doc.id)
                                setDocMenuOpen(false)
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer"
                              style={{
                                backgroundColor:
                                  doc.id === activeDoc?.id
                                    ? 'var(--accent-subtle)'
                                    : 'transparent',
                                color:
                                  doc.id === activeDoc?.id
                                    ? 'var(--text-blue)'
                                    : 'var(--text-primary)',
                              }}
                            >
                              <span className="truncate max-w-[190px]">
                                {doc.filename}
                              </span>
                              {doc.id === activeDoc?.id && <Check size={13} />}
                            </button>
                          ))}
                        </div>

                        <div
                          className="border-t pt-1 mt-1"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <button
                            onClick={() => {
                              setDocMenuOpen(false)
                              onOpenSidebar()
                            }}
                            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer font-medium"
                            style={{
                              color: 'var(--text-blue)',
                            }}
                          >
                            <Upload size={13} />
                            <span>Upload & Manage in Sidebar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Send Button [↑] */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: input.trim()
                        ? 'var(--accent-primary)'
                        : 'var(--bg-surface-elevated)',
                      color: input.trim()
                        ? 'var(--text-inverse)'
                        : 'var(--text-tertiary)',
                    }}
                    title="Send message"
                  >
                    <ArrowUp size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>

            <p
              className="text-center text-[11px] mt-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Grounds answers strictly in your uploaded documents with precise citations.
            </p>
          </div>
        </div>
      ) : (
        /* Active Conversation Flow */
        <>
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-4">
            <div className="max-w-2xl sm:max-w-3xl mx-auto w-full min-h-full flex flex-col justify-end">
              <div className="space-y-4 pb-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {/* Real-time Document Processing Card if any is uploading */}
                {processingDoc && (
                  <DocumentProcessingCard
                    doc={processingDoc}
                    onStartChatting={() => onSelectDoc(processingDoc.id)}
                  />
                )}

                {/* Borderless Free Dynamic Answering Status (Hidden once answer arrives!) */}
                {loading && (
                  <div className="flex items-center gap-2.5 py-3 text-xs animate-fade-in font-medium">
                    <div className="flex items-center gap-1 text-[var(--text-coral)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {dynamicThinkingStatus}
                    </span>
                    <span
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {elapsedSeconds}s
                    </span>
                  </div>
                )}
              </div>

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Docked Chatbox when messages exist */}
          <div className="w-full px-4 sm:px-8 md:px-12 pb-6 pt-2 shrink-0">
            <div className="max-w-2xl sm:max-w-3xl mx-auto w-full">
              <div
                className="relative rounded-2xl border transition-all shadow-lg p-2.5 pl-3.5 focus-within:ring-2 focus-within:ring-blue-500/20"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                }}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask about your documents, policies, or data..."
                  className="w-full max-h-[160px] min-h-[36px] py-1 bg-transparent text-[14.5px] resize-none outline-none leading-relaxed font-sans"
                  style={{
                    color: 'var(--text-primary)',
                  }}
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {/* + Button: Navigates to Document Sidebar */}
                    <button
                      type="button"
                      onClick={onOpenSidebar}
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer hover:opacity-85"
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-secondary)',
                      }}
                      title="Upload or manage documents"
                    >
                      <Plus size={15} />
                    </button>

                    {/* Document Selector Shifted Inside Chatbox */}
                    <div className="relative" ref={docDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setDocMenuOpen(!docMenuOpen)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-85"
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <FileText size={11} className="text-[var(--text-blue)]" />
                        <span className="max-w-[130px] truncate">
                          {activeDoc ? activeDoc.filename : 'Select Document'}
                        </span>
                        <ChevronDown size={11} className="text-[var(--text-dim)]" />
                      </button>

                      {/* Dropdown Menu */}
                      {docMenuOpen && (
                        <div
                          className="absolute left-0 bottom-full mb-2 w-64 rounded-xl border p-1.5 shadow-2xl z-50 animate-fade-in"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-medium)',
                          }}
                        >
                          <div
                            className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            Change Document
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-0.5 my-1">
                            {documents.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={() => {
                                  onSelectDoc(doc.id)
                                  setDocMenuOpen(false)
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer"
                                style={{
                                  backgroundColor:
                                    doc.id === activeDoc?.id
                                      ? 'var(--accent-subtle)'
                                      : 'transparent',
                                  color:
                                    doc.id === activeDoc?.id
                                      ? 'var(--text-blue)'
                                      : 'var(--text-primary)',
                                }}
                              >
                                <span className="truncate max-w-[190px]">
                                  {doc.filename}
                                </span>
                                {doc.id === activeDoc?.id && <Check size={13} />}
                              </button>
                            ))}
                          </div>

                          <div
                            className="border-t pt-1 mt-1"
                            style={{ borderColor: 'var(--border-subtle)' }}
                          >
                            <button
                              onClick={() => {
                                setDocMenuOpen(false)
                                onOpenSidebar()
                              }}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer font-medium"
                              style={{
                                color: 'var(--text-blue)',
                              }}
                            >
                              <Upload size={13} />
                              <span>Upload & Manage in Sidebar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Send Button [↑] */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: input.trim()
                        ? 'var(--accent-primary)'
                        : 'var(--bg-surface-elevated)',
                      color: input.trim()
                        ? 'var(--text-inverse)'
                        : 'var(--text-tertiary)',
                    }}
                    title="Send message"
                  >
                    <ArrowUp size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
