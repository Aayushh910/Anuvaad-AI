import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import LandingPage from './components/LandingPage'
import { useDocuments } from './hooks/useDocuments'
import { useChat } from './hooks/useChat'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { dark, toggle: toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Default route is '/' (Landing Page) unless URL path is '/chat'
  const [currentRoute, setCurrentRoute] = useState<'/' | '/chat'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/chat') {
      return '/chat'
    }
    return '/'
  })

  const [pendingQuery, setPendingQuery] = useState<string | undefined>()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const { documents, activeDocId, setActiveDocId, upload, removeDocument, reindexDoc } =
    useDocuments()
  const { messages, loading, sendMessage, clearMessages } = useChat()

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null

  // Browser history sync (handles Back & Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname === '/chat' ? '/chat' : '/'
      setCurrentRoute(path)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Smooth route transition without reloading
  const navigate = useCallback((to: '/' | '/chat', query?: string, openSidebar: boolean = false) => {
    if (query !== undefined) {
      setPendingQuery(query)
    }
    if (openSidebar) {
      setSidebarOpen(true)
    }
    setIsTransitioning(true)
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', to)
      }
      setCurrentRoute(to)
      setIsTransitioning(false)
    }, 240)
  }, [])

  const handleSelectDocument = useCallback(
    (id: string) => {
      setActiveDocId(id)
      setSidebarOpen(false)
      if (currentRoute !== '/chat') {
        navigate('/chat')
      }
    },
    [setActiveDocId, currentRoute, navigate],
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

  if (currentRoute === '/') {
    return (
      <LandingPage
        dark={dark}
        onToggleTheme={toggleTheme}
        onNavigateChat={(initialQuery?: string, openSidebar?: boolean) =>
          navigate('/chat', initialQuery, openSidebar)
        }
        onUpload={upload}
        documents={documents}
        activeDocId={activeDocId}
        onSelectDoc={handleSelectDocument}
        isTransitioning={isTransitioning}
      />
    )
  }

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden select-text transition-all duration-200 ${
        isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
      }`}
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
          onReindex={reindexDoc}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          onNavigateLanding={() => navigate('/')}
          dark={dark}
        />
      </div>

      {/* Normal Click-Away Overlay (NO BLUR, background remains completely sharp and visible) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/25 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Interface with smooth slide-up fade */}
      <div className="flex-1 flex flex-col h-full overflow-hidden animate-slide-up-fade">
        <ChatArea
          messages={messages}
          loading={loading}
          activeDoc={activeDoc}
          documents={documents}
          onSelectDoc={handleSelectDocument}
          onSend={handleSendMessage}
          onUpload={upload}
          onReindex={reindexDoc}
          onRemoveDoc={removeDocument}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewChat={handleNewChat}
          onNavigateLanding={() => navigate('/')}
          initialQuery={pendingQuery}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </div>
    </div>
  )
}
