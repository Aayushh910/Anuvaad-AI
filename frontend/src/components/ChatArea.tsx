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
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import Logo from './Logo'
import MessageBubble from './MessageBubble'
import DocumentProcessingCard from './DocumentProcessingCard'
import { useRotatingPlaceholder } from '../hooks/useRotatingPlaceholder'
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
  onNavigateLanding?: () => void
  initialQuery?: string
  dark: boolean
  onToggleTheme: () => void
}

const SUGGESTED_PROMPTS = [
  'Summarize document',
  'Extract table data & metrics',
  'Key takeaways & conclusions',
]

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
  onNavigateLanding,
  initialQuery,
  dark,
  onToggleTheme,
}: ChatAreaProps) {
  const [input, setInput] = useState(initialQuery || '')
  const { text: dynamicPlaceholder, isFading } = useRotatingPlaceholder(5000, 400)
  const [docMenuOpen, setDocMenuOpen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(1)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [showUploadAlert, setShowUploadAlert] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const docDropdownRef = useRef<HTMLDivElement>(null)

  // Sync initial query if passed and position cursor at end
  useEffect(() => {
    if (initialQuery) {
      setInput(initialQuery)
      if (documents.length === 0) {
        setShowUploadAlert(true)
      }
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(initialQuery.length, initialQuery.length)
        }
      }, 50)
    } else {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [initialQuery, documents.length])

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

  // Timer for live reasoning/retrieval status
  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(1)
      return
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [loading])

  // Scroll to bottom on new message or loading update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus textarea on mount or when active document changes
  useEffect(() => {
    textareaRef.current?.focus()
  }, [activeDoc])

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)
      setShowUploadAlert(false)
      // Auto-grow textarea
      const target = e.target
      target.style.height = 'auto'
      target.style.height = `${Math.min(target.scrollHeight, 180)}px`
    },
    [],
  )

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    if (documents.length === 0) {
      setShowUploadAlert(true)
      return
    }

    setShowUploadAlert(false)
    setCurrentQuestion(trimmed)
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, loading, documents.length, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setShowUploadAlert(false)
        onUpload(file)
      }
      e.target.value = ''
    },
    [onUpload],
  )

  const handlePromptClick = useCallback(
    (promptText: string) => {
      setInput(promptText)
      textareaRef.current?.focus()
    },
    [],
  )

  // Find any document currently uploading or indexing
  const processingDoc = useMemo(() => {
    return (
      documents.find((d) => d.step !== 'ready' && d.step !== 'error') || null
    )
  }, [documents])

  // Dynamic context-aware status label
  const dynamicThinkingStatus = useMemo(() => {
    const docName = activeDoc ? activeDoc.filename : 'documents'
    const q = currentQuestion.toLowerCase()

    if (q.includes('table') || q.includes('data') || q.includes('number')) {
      if (elapsedSeconds <= 2) return `Extracting structured tables from ${docName}...`
      if (elapsedSeconds <= 4) return `Analyzing rows, columns, and metric relations...`
      return `Translating tabular insights...`
    }

    if (q.includes('image') || q.includes('chart') || q.includes('diagram') || q.includes('graph')) {
      if (elapsedSeconds <= 2) return `Querying multimodal vision embeddings...`
      if (elapsedSeconds <= 4) return `Interpreting visual elements in ${docName}...`
      return `Synthesizing visual analysis...`
    }

    if (elapsedSeconds <= 2) return `Searching vector index across ${docName}...`
    if (elapsedSeconds <= 4) return `Grounding contextual passages with citations...`
    return `Formulating fact-checked answer...`
  }, [elapsedSeconds, activeDoc, currentQuestion])

  const isEmpty = messages.length === 0

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden relative select-text transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Navigation Bar: Clean & Minimal (NO Landing text button) */}
      <header className="flex items-center justify-between px-6 pt-3.5 pb-2.5 z-20 shrink-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Left: Menu Button & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition-all cursor-pointer hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            title="Open documents sidebar"
            aria-label="Open documents sidebar"
          >
            <Menu size={15} />
          </button>

          {/* Anuvaad AI Logo (Clickable to navigate back to /) */}
          <div
            onClick={onNavigateLanding}
            className="flex items-center gap-2 cursor-pointer group"
            title="Return to home"
          >
            <Logo variant="horizontal" dark={dark} className="h-7 w-auto group-hover:opacity-85 transition-opacity" />
          </div>
        </div>

        {/* Right: New Chat button & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* New Chat Button */}
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
            <RotateCcw size={12} className="text-[var(--text-brand)]" />
            <span>New Chat</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition-all cursor-pointer hover:scale-105 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark/light mode"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {isEmpty ? (
        /* Anuvaad AI Centered Welcome & Input */
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 z-10 animate-fade-in -mt-6">
          {/* Concise Brand Header with requested tagline */}
          <div className="flex flex-col items-center mb-5 select-none text-center">
            <Logo variant="horizontal" dark={dark} className="h-9 sm:h-10 w-auto mb-2" />
            <h1
              className="text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap"
              style={{ color: 'var(--text-primary)' }}
            >
              Ask your documents anything.
            </h1>
          </div>

          {/* Inform User to Upload Document if Not Uploaded */}
          {(documents.length === 0 || showUploadAlert) && (
            <div
              className="w-full max-w-2xl mb-3.5 px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs animate-fade-in"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                borderColor: 'var(--border-medium)',
                color: 'var(--text-primary)',
              }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--text-brand)] shrink-0" />
                <span>Please upload a PDF document first to begin answering questions.</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90 shrink-0 shadow-2xs"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: dark ? '#1B1B3A' : '#ffffff',
                }}
              >
                Upload PDF
              </button>
            </div>
          )}

          {/* Real-time Document Processing Card if any is uploading */}
          {processingDoc && (
            <div className="w-full max-w-2xl mb-3.5">
              <DocumentProcessingCard
                doc={processingDoc}
                onStartChatting={() => onSelectDoc(processingDoc.id)}
              />
            </div>
          )}

          {/* Centered Chat Box */}
          <div className="w-full max-w-2xl">
            <div
              className="rounded-2xl border transition-all shadow-xl p-3 focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/30"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
              }}
            >
              <div className="relative w-full">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="w-full py-1 px-1 bg-transparent text-[14.5px] resize-none outline-none leading-relaxed font-sans relative z-10"
                  style={{
                    color: 'var(--text-primary)',
                  }}
                />
                {!input && (
                  <span
                    className={`pointer-events-none absolute left-1 top-1 text-[14.5px] leading-relaxed select-none transition-all duration-400 ease-in-out truncate max-w-[95%] ${isFading ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
                      }`}
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {dynamicPlaceholder}
                  </span>
                )}
              </div>

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
                      <FileText size={12} className="text-[var(--text-brand)]" />
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
                          Context
                        </div>

                        {/* All Documents Option */}
                        <div
                          onClick={() => {
                            onSelectDoc('')
                            setDocMenuOpen(false)
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${!activeDoc
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-medium'
                              : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Sparkles size={12} className="shrink-0 text-[var(--text-brand)]" />
                            <span className="truncate">All Indexed Documents</span>
                          </div>
                          {!activeDoc && <Check size={12} />}
                        </div>

                        {/* Individual Documents List */}
                        <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5 border-t pt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                          {documents.map((doc) => {
                            const isSelected = activeDoc?.id === doc.id
                            return (
                              <div
                                key={doc.id}
                                onClick={() => {
                                  onSelectDoc(doc.id)
                                  setDocMenuOpen(false)
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${isSelected
                                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-medium'
                                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <FileText size={12} className="shrink-0 text-[var(--text-brand)]" />
                                  <span className="truncate">{doc.filename}</span>
                                </div>
                                {isSelected && <Check size={12} />}
                              </div>
                            )
                          })}
                        </div>

                        {/* Upload directly from dropdown */}
                        <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click()
                              setDocMenuOpen(false)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer hover:bg-[var(--bg-hover)]"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <Upload size={12} className="text-[var(--text-brand)]" />
                            <span>Upload new PDF</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Send Button */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
                    style={{
                      backgroundColor: input.trim()
                        ? 'var(--accent-primary)'
                        : 'var(--bg-surface-elevated)',
                      color: input.trim()
                        ? dark ? '#1B1B3A' : '#ffffff'
                        : 'var(--text-tertiary)',
                    }}
                    title="Send message"
                  >
                    <ArrowUp size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>

            {/* Exactly 3 compact suggestions (No extra text) */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
              {SUGGESTED_PROMPTS.map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePromptClick(promptText)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-normal border transition-all cursor-pointer hover:scale-[1.02] shadow-2xs text-left"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="text-[var(--text-brand)] mr-1 font-medium">✦</span>
                  <span>{promptText}</span>
                </button>
              ))}
            </div>
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

                {/* Dynamic Answering Status */}
                {loading && (
                  <div className="flex items-center gap-2.5 py-3 text-xs animate-fade-in font-medium">
                    <div className="flex items-center gap-1 text-[var(--accent-primary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:300ms]" />
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
                className="relative rounded-2xl border transition-all shadow-lg p-2.5 pl-3.5 focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/30"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                }}
              >
                <div className="relative w-full">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="w-full max-h-[160px] min-h-[36px] py-1 bg-transparent text-[14.5px] resize-none outline-none leading-relaxed font-sans relative z-10"
                    style={{
                      color: 'var(--text-primary)',
                    }}
                  />
                  {!input && (
                    <span
                      className={`pointer-events-none absolute left-0 top-1 text-[14.5px] leading-relaxed select-none transition-all duration-400 ease-in-out truncate max-w-[85%] ${isFading ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
                        }`}
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {dynamicPlaceholder}
                    </span>
                  )}
                </div>

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

                    {/* Document Selector Inside Chatbox */}
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
                        <FileText size={11} className="text-[var(--text-brand)]" />
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
                            Context
                          </div>

                          {/* All Documents Option */}
                          <div
                            onClick={() => {
                              onSelectDoc('')
                              setDocMenuOpen(false)
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${!activeDoc
                                ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-medium'
                                : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Sparkles size={12} className="shrink-0 text-[var(--text-brand)]" />
                              <span className="truncate">All Indexed Documents</span>
                            </div>
                            {!activeDoc && <Check size={12} />}
                          </div>

                          {/* Individual Documents List */}
                          <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5 border-t pt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                            {documents.map((doc) => {
                              const isSelected = activeDoc?.id === doc.id
                              return (
                                <div
                                  key={doc.id}
                                  onClick={() => {
                                    onSelectDoc(doc.id)
                                    setDocMenuOpen(false)
                                  }}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${isSelected
                                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-medium'
                                      : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                                    }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText size={12} className="shrink-0 text-[var(--text-brand)]" />
                                    <span className="truncate">{doc.filename}</span>
                                  </div>
                                  {isSelected && <Check size={12} />}
                                </div>
                              )
                            })}
                          </div>

                          {/* Upload directly from dropdown */}
                          <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                            <button
                              type="button"
                              onClick={() => {
                                fileInputRef.current?.click()
                                setDocMenuOpen(false)
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer hover:bg-[var(--bg-hover)]"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              <Upload size={12} className="text-[var(--text-brand)]" />
                              <span>Upload new PDF</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Send Button */}
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || loading}
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
                      style={{
                        backgroundColor: input.trim()
                          ? 'var(--accent-primary)'
                          : 'var(--bg-surface-elevated)',
                        color: input.trim()
                          ? dark ? '#1B1B3A' : '#ffffff'
                          : 'var(--text-tertiary)',
                      }}
                      title="Send message"
                    >
                      <ArrowUp size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
