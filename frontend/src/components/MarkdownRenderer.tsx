import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null)

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code)
    setCopiedCodeIdx(idx)
    setTimeout(() => setCopiedCodeIdx(null), 2000)
  }

  // Parse inline elements: **bold**, *italic*, `code`, and [S1] citation tags
  const renderInline = (text: string): React.ReactNode => {
    if (!text) return null
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
          <em key={i} className="italic text-[var(--text-primary)] opacity-95">
            {part.slice(1, -1)}
          </em>
        )
      }

      // Inline `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded text-[13px] font-mono tracking-tight"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-brand)',
              border: '1px solid var(--border-subtle)',
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
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-semibold font-mono tracking-tight select-none shadow-xs align-middle"
            style={{
              backgroundColor: 'var(--citation-bg)',
              color: 'var(--citation-text)',
              border: '1px solid var(--border-focus)',
            }}
            title={`Source Reference ${part}`}
          >
            {part}
          </span>
        )
      }

      return part
    })
  }

  // Block-level Parser
  const parseBlocks = (raw: string) => {
    const lines = raw.split(/\r?\n/)
    const blocks: React.ReactNode[] = []

    let i = 0
    let blockKey = 0

    while (i < lines.length) {
      const line = lines[i]

      // 1. Fenced Code Blocks (```lang ... ```)
      if (line.trim().startsWith('```')) {
        const lang = line.trim().replace(/^```/, '').trim()
        const codeLines: string[] = []
        i++
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i++
        }
        i++ // consume closing ```
        const codeContent = codeLines.join('\n')
        const currentIdx = blockKey

        blocks.push(
          <div
            key={blockKey++}
            className="my-3.5 rounded-xl overflow-hidden border text-xs"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="flex items-center justify-between px-3.5 py-1.5 border-b text-[11px] font-mono select-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>{lang || 'code'}</span>
              <button
                type="button"
                onClick={() => handleCopyCode(codeContent, currentIdx)}
                className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {copiedCodeIdx === currentIdx ? (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto font-mono text-[13px] leading-relaxed text-[var(--text-primary)]">
              <code>{codeContent}</code>
            </pre>
          </div>
        )
        continue
      }

      // 2. Markdown Tables (| Col 1 | Col 2 |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = []
        while (
          i < lines.length &&
          lines[i].trim().startsWith('|') &&
          lines[i].trim().endsWith('|')
        ) {
          tableLines.push(lines[i].trim())
          i++
        }

        if (tableLines.length >= 2) {
          const headerCells = tableLines[0]
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())

          // Second line is separator (|---|---|)
          const bodyLines = tableLines.slice(2)

          blocks.push(
            <div
              key={blockKey++}
              className="my-4 overflow-x-auto rounded-xl border shadow-xs"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {headerCells.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        className="py-2.5 px-3.5 font-semibold text-[var(--text-bold)] text-[12.5px]"
                      >
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {bodyLines.map((bLine, rIdx) => {
                    const rowCells = bLine
                      .split('|')
                      .slice(1, -1)
                      .map((c) => c.trim())
                    return (
                      <tr
                        key={rIdx}
                        className="hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {rowCells.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="py-2 px-3.5 text-[var(--text-primary)] text-[12.5px] leading-relaxed"
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
          continue
        }
      }

      // 3. Headings
      if (line.startsWith('# ')) {
        blocks.push(
          <h1
            key={blockKey++}
            className="text-xl font-bold mt-5 mb-2 text-[var(--text-bold)] tracking-tight"
          >
            {renderInline(line.replace(/^#\s+/, ''))}
          </h1>
        )
        i++
        continue
      }
      if (line.startsWith('## ')) {
        blocks.push(
          <h2
            key={blockKey++}
            className="text-lg font-bold mt-4 mb-1.5 text-[var(--text-bold)] tracking-tight"
          >
            {renderInline(line.replace(/^##\s+/, ''))}
          </h2>
        )
        i++
        continue
      }
      if (line.startsWith('### ')) {
        blocks.push(
          <h3
            key={blockKey++}
            className="text-base font-semibold mt-3.5 mb-1 text-[var(--text-bold)] tracking-tight"
          >
            {renderInline(line.replace(/^###\s+/, ''))}
          </h3>
        )
        i++
        continue
      }
      if (line.startsWith('#### ')) {
        blocks.push(
          <h4
            key={blockKey++}
            className="text-[14.5px] font-semibold mt-3 mb-1 text-[var(--text-bold)]"
          >
            {renderInline(line.replace(/^####\s+/, ''))}
          </h4>
        )
        i++
        continue
      }

      // 4. Blockquotes (> ...)
      if (line.startsWith('>')) {
        const quoteLines: string[] = []
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s*/, ''))
          i++
        }
        blocks.push(
          <blockquote
            key={blockKey++}
            className="my-3 pl-3.5 py-1 border-l-3 rounded-r-md text-[var(--text-secondary)] italic text-[14px]"
            style={{
              borderColor: 'var(--quote-border)',
              backgroundColor: 'var(--bg-thinking)',
            }}
          >
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx} className="my-0.5 leading-relaxed">
                {renderInline(ql)}
              </p>
            ))}
          </blockquote>
        )
        continue
      }

      // 5. Unordered List (- or * or •)
      if (line.match(/^[-*•]\s+/)) {
        const listItems: string[] = []
        while (i < lines.length && lines[i].match(/^[-*•]\s+/)) {
          listItems.push(lines[i].replace(/^[-*•]\s+/, ''))
          i++
        }
        blocks.push(
          <ul
            key={blockKey++}
            className="my-2.5 pl-5 list-disc space-y-1 text-[var(--text-primary)]"
          >
            {listItems.map((item, lIdx) => (
              <li key={lIdx} className="leading-relaxed text-[14.5px]">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        )
        continue
      }

      // 6. Ordered List (1. 2. ...)
      if (line.match(/^\d+[\.)]\s+/)) {
        const listItems: string[] = []
        while (i < lines.length && lines[i].match(/^\d+[\.)]\s+/)) {
          listItems.push(lines[i].replace(/^\d+[\.)]\s+/, ''))
          i++
        }
        blocks.push(
          <ol
            key={blockKey++}
            className="my-2.5 pl-5 list-decimal space-y-1 text-[var(--text-primary)]"
          >
            {listItems.map((item, lIdx) => (
              <li key={lIdx} className="leading-relaxed text-[14.5px]">
                {renderInline(item)}
              </li>
            ))}
          </ol>
        )
        continue
      }

      // 7. Empty line spacer
      if (!line.trim()) {
        i++
        continue
      }

      // 8. Standard paragraph
      const paragraphLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith('```') &&
        !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('>') &&
        !lines[i].match(/^[-*•]\s+/) &&
        !lines[i].match(/^\d+[\.)]\s+/)
      ) {
        paragraphLines.push(lines[i])
        i++
      }

      blocks.push(
        <p
          key={blockKey++}
          className="my-2 text-[14.5px] leading-relaxed text-[var(--text-primary)]"
        >
          {paragraphLines.map((pLine, pIdx) => (
            <React.Fragment key={pIdx}>
              {renderInline(pLine)}
              {pIdx < paragraphLines.length - 1 && ' '}
            </React.Fragment>
          ))}
        </p>
      )
    }

    return blocks
  }

  return (
    <div
      className={`w-full font-sans antialiased text-[14.5px] leading-relaxed ${className}`}
      style={{
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
      }}
    >
      {parseBlocks(content)}
    </div>
  )
}
