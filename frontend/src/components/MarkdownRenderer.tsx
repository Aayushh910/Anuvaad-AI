import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  // Parse lines for blockquotes, lists, headings, and paragraphs
  const renderFormattedLine = (line: string, key: number) => {
    // Blockquote
    if (line.startsWith('>')) {
      return (
        <blockquote
          key={key}
          className="border-l-3 border-[#3b82f6] pl-3 py-0.5 my-2 italic text-[var(--text-secondary)]"
        >
          {renderInlineFormatting(line.replace(/^>\s*/, ''))}
        </blockquote>
      )
    }

    // Headings
    if (line.startsWith('### ')) {
      return (
        <h3 key={key} className="text-base font-semibold mt-3 mb-1 font-display text-[var(--text-bold)]">
          {renderInlineFormatting(line.replace(/^###\s+/, ''))}
        </h3>
      )
    }
    if (line.startsWith('## ')) {
      return (
        <h2 key={key} className="text-lg font-semibold mt-4 mb-1 font-display text-[var(--text-bold)]">
          {renderInlineFormatting(line.replace(/^##\s+/, ''))}
        </h2>
      )
    }

    // Bullet lists
    if (line.match(/^[-*]\s+/)) {
      return (
        <li key={key} className="ml-4 list-disc my-1 leading-relaxed">
          {renderInlineFormatting(line.replace(/^[-*]\s+/, ''))}
        </li>
      )
    }

    // Numbered lists
    if (line.match(/^\d+\.\s+/)) {
      return (
        <li key={key} className="ml-4 list-decimal my-1 leading-relaxed">
          {renderInlineFormatting(line.replace(/^\d+\.\s+/, ''))}
        </li>
      )
    }

    // Empty lines
    if (!line.trim()) {
      return <div key={key} className="h-2" />
    }

    // Standard paragraph line
    return (
      <p key={key} className="my-1 leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    )
  }

  // Parse inline elements: **bold**, *italic*, `code`, and [S1] citation tags
  const renderInlineFormatting = (text: string): React.ReactNode => {
    // Regex matches:
    // 1. **bold**
    // 2. *italic*
    // 3. `code`
    // 4. [S1], [S2] source tags
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[S\d+\])/g
    const parts = text.split(tokenRegex)

    return parts.map((part, i) => {
      // Bold **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="font-semibold text-[var(--text-bold)]">
            {part.slice(2, -2)}
          </strong>
        )
      }

      // Italic *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={i} className="italic">
            {part.slice(1, -1)}
          </em>
        )
      }

      // Inline `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded text-[13px] font-mono"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }

      // Source Tag [S1], [S2]
      if (part.match(/^\[S\d+\]$/)) {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-semibold font-mono tracking-tight cursor-default select-none shadow-xs"
            style={{
              backgroundColor: 'var(--citation-bg)',
              color: 'var(--citation-text)',
            }}
            title={`Citation ${part}`}
          >
            {part}
          </span>
        )
      }

      return part
    })
  }

  const lines = content.split('\n')

  return (
    <div className={`prose-custom text-[14.5px] font-normal ${className}`}>
      {lines.map((line, idx) => renderFormattedLine(line, idx))}
    </div>
  )
}
