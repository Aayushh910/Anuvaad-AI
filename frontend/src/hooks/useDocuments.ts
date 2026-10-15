import { useState, useCallback, useEffect } from 'react'
import { uploadDocument, indexDocument, listDocuments } from '../services/api'
import type { Document } from '../types'

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const loadInitialDocuments = async () => {
      const stored = await listDocuments()
      if (!mounted || stored.length === 0) return

      const initialDocs: Document[] = stored.map((item) => ({
        id: item.document_id,
        filename: item.original_filename,
        sizeBytes: item.size_bytes,
        pageCount: item.page_count,
        characterCount: item.character_count,
        imageCount: item.image_count,
        tableCount: item.table_count,
        processedAt: item.processed_at ?? new Date().toISOString(),
        step: 'ready' as const,
      }))

      setDocuments((prev) => {
        // Merge without duplicating
        const existingIds = new Set(prev.map((d) => d.id))
        const newItems = initialDocs.filter((d) => !existingIds.has(d.id))
        return [...prev, ...newItems]
      })

      if (initialDocs.length > 0 && !activeDocId) {
        setActiveDocId(initialDocs[0].id)
      }
    }

    loadInitialDocuments()
    return () => {
      mounted = false
    }
  }, [activeDocId])

  const updateDoc = useCallback((id: string, patch: Partial<Document>) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }, [])

  const upload = useCallback(
    async (file: File) => {
      const tempId = `tmp-${Date.now()}`
      const placeholder: Document = {
        id: tempId,
        filename: file.name,
        sizeBytes: file.size,
        pageCount: 0,
        characterCount: 0,
        imageCount: 0,
        tableCount: 0,
        processedAt: new Date().toISOString(),
        step: 'uploading',
      }
      setDocuments((prev) => [placeholder, ...prev])

      try {
        // Step 1: Upload with progress
        const up = await uploadDocument(file, (pct) => {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === tempId ? { ...d, uploadProgress: pct } as Document & { uploadProgress: number } : d,
            ),
          )
        })

        const docId = up.document_id

        // Step 2: Update with extracted data
        const doc: Document = {
          id: docId,
          filename: up.filename,
          sizeBytes: up.size_bytes,
          pageCount: up.page_count,
          characterCount: up.character_count,
          imageCount: up.image_count,
          tableCount: up.table_count,
          processedAt: new Date().toISOString(),
          step: 'chunking',
        }
        setDocuments((prev) => prev.map((d) => (d.id === tempId ? doc : d)))

        // Step 3: Index
        updateDoc(docId, { step: 'indexing' })
        const idx = await indexDocument(docId)

        updateDoc(docId, {
          step: 'ready',
          chunkCount: idx.chunk_count,
          indexedChunks: idx.indexed_chunks,
          indexedTables: idx.indexed_tables,
        })

        setActiveDocId(docId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === tempId || d.step !== 'ready'
              ? { ...d, step: 'error' as const, error: msg }
              : d,
          ),
        )
      }
    },
    [updateDoc],
  )

  const removeDocument = useCallback(
    (id: string) => {
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      if (activeDocId === id) setActiveDocId(null)
    },
    [activeDocId],
  )

  return { documents, activeDocId, setActiveDocId, upload, removeDocument }
}
