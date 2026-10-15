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
      if (id !== activeDocId) {
        setActiveDocId(id)
        clearMessages()
      }
      setSidebarOpen(false)
    },
    [activeDocId, setActiveDocId, clearMessages],
  )

  const handleSendMessage = useCallback(
    (question: string) => {
      sendMessage(question, activeDocId ?? undefined)
    },
    [sendMessage, activeDocId],
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#07080b] text-[#e6edf3]">
      {/* Sliding Off-Canvas Sidebar */}
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
        />
      </div>

      {/* Backdrop when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Interface (100% full screen, free components, no boundaries or limits visible) */}
      <ChatArea
        messages={messages}
        loading={loading}
        activeDoc={activeDoc}
        onSend={handleSendMessage}
        onUpload={upload}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        dark={dark}
        onToggleTheme={toggleTheme}
      />
    </div>
  )
}
