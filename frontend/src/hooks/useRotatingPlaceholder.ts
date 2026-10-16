import { useState, useEffect } from 'react'

export const PLACEHOLDER_MESSAGES = [
  'What would you like to understand?',
  'Ask a question or explore your PDF...',
  'Find answers, insights, and key details...',
  'Type or speak your question...',
]

export interface RotatingPlaceholderState {
  text: string
  isFading: boolean
}

/**
 * Custom hook to smoothly rotate placeholder messages with at least 5s wait and smooth fade transition
 */
export function useRotatingPlaceholder(
  waitDurationMs: number = 5000,
  fadeDurationMs: number = 400,
): RotatingPlaceholderState {
  const [index, setIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    let fadeTimeout: NodeJS.Timeout

    const interval = setInterval(() => {
      // Step 1: Trigger smooth fade out
      setIsFading(true)

      // Step 2: Swap message and fade back in after fadeDurationMs
      fadeTimeout = setTimeout(() => {
        setIndex((prev) => (prev + 1) % PLACEHOLDER_MESSAGES.length)
        setIsFading(false)
      }, fadeDurationMs)
    }, waitDurationMs)

    return () => {
      clearInterval(interval)
      if (fadeTimeout) clearTimeout(fadeTimeout)
    }
  }, [waitDurationMs, fadeDurationMs])

  return {
    text: PLACEHOLDER_MESSAGES[index],
    isFading,
  }
}
