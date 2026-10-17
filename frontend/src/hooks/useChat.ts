import { useState, useCallback } from 'react'
import { askQuestion } from '../services/api'
import type { Message } from '../types'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (question: string, documentId?: string) => {
      setError(null)

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)

      try {
        const res = await askQuestion(question, documentId)
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          model: res.model,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to get answer'
        setError(msg)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Sorry, something went wrong: ${msg}`,
            timestamp: Date.now(),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearMessages }
}
