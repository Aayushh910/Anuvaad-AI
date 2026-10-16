import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import { useDocuments } from './hooks/useDocuments'
import { useChat } from './hooks/useChat'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { dark, toggle: toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { documents, activeDocId, setActiveDocId, upload, removeDocument } =
    useDocuments()
  const { messages, loading, sendMessage, clearMessages } = useChat()

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null

  const handleSelectDocument = useCallback(
    (id: string) => {
      setActiveDocId(id)
      setSidebarOpen(false)
    },
    [setActiveDocId],
  )

  const handleNewChat = useCallback(() => {
    clearMessages()
    setSidebarOpen(false)
  }, [clearMessages])

  const handleSendMessage = useCallback(
    (question: string) => {
      sendMessage(question, activeDocId ?? undefined)
    },
    [sendMessage, activeDocId],
  )

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-text transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Sliding Off-Canvas Sidebar (Left) with Drop Shadow */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          documents={documents}
          activeDocId={activeDocId}
          onSelect={handleSelectDocument}
          onUpload={upload}
          onRemove={removeDocument}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Normal Click-Away Overlay (NO BLUR, background remains completely sharp and visible) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/25 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatArea
          messages={messages}
          loading={loading}
          activeDoc={activeDoc}
          documents={documents}
          onSelectDoc={handleSelectDocument}
          onSend={handleSendMessage}
          onUpload={upload}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewChat={handleNewChat}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </div>
    </div>
  )
}
