import { useState, useCallback, useEffect } from 'react'
import {
  uploadDocument,
  indexDocument,
  reindexDocument,
  deleteDocument,
  listDocuments,
} from '../services/api'
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
    async (file: File, onUploaded?: (docId: string) => void): Promise<string | null> => {
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
        // Step 1: Upload with live network and extraction progress
        const up = await uploadDocument(file, (pct, currentStep) => {
          setDocuments((prev) =>
            prev.map((d) => {
              if (d.id !== tempId) return d
              const step = currentStep ?? (pct >= 100 ? 'extracting' : 'uploading')
              return {
                ...d,
                step,
                uploadProgress: pct,
              } as Document
            }),
          )
        })

        const docId = up.document_id

        // Step 2: Show extraction complete, transition to chunking
        const doc: Document = {
          id: docId,
          filename: up.filename,
          sizeBytes: up.size_bytes,
          pageCount: up.page_count,
          characterCount: up.character_count,
          imageCount: up.image_count,
          tableCount: up.table_count,
          chunkCount: up.chunk_count,
          indexedChunks: up.indexed_chunks,
          indexedTables: up.indexed_tables,
          processedAt: new Date().toISOString(),
          step: 'chunking',
        }
        setDocuments((prev) => prev.map((d) => (d.id === tempId ? doc : d)))
        setActiveDocId(docId)

        if (onUploaded) {
          onUploaded(docId)
        }

        // Step 3: Transition to indexing with smooth visual synchronization
        await new Promise((r) => setTimeout(r, 450))
        updateDoc(docId, { step: 'indexing' })

        let chunkCount = up.chunk_count
        let indexedChunks = up.indexed_chunks
        let indexedTables = up.indexed_tables

        if (!chunkCount || !indexedChunks) {
          const idx = await indexDocument(docId)
          chunkCount = idx.chunk_count
          indexedChunks = idx.indexed_chunks
          indexedTables = idx.indexed_tables
        } else {
          await new Promise((r) => setTimeout(r, 350))
        }

        // Step 4: Fully Ready!
        updateDoc(docId, {
          step: 'ready',
          chunkCount,
          indexedChunks,
          indexedTables,
        })

        return docId
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === tempId || d.step !== 'ready'
              ? { ...d, step: 'error' as const, error: msg }
              : d,
          ),
        )
        return null
      }
    },
    [updateDoc],
  )

  const deleteDoc = useCallback(
    async (id: string): Promise<boolean> => {
      // If it's a temporary uploading document, just remove from state
      if (id.startsWith('tmp-')) {
        setDocuments((prev) => prev.filter((d) => d.id !== id))
        if (activeDocId === id) setActiveDocId(null)
        return true
      }

      updateDoc(id, { isDeleting: true })

      try {
        await deleteDocument(id)
        setDocuments((prev) => prev.filter((d) => d.id !== id))
        setActiveDocId((current) => {
          if (current === id) {
            const remaining = documents.filter((d) => d.id !== id)
            return remaining.length > 0 ? remaining[0].id : null
          }
          return current
        })
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete document'
        updateDoc(id, { isDeleting: false, error: msg })
        throw err
      }
    },
    [activeDocId, documents, updateDoc],
  )

  const reindexDoc = useCallback(
    async (id: string, fullReprocess: boolean = false): Promise<boolean> => {
      updateDoc(id, { step: 'chunking', isReindexing: true, error: undefined })

      try {
        const idx = await reindexDocument(id, fullReprocess)

        updateDoc(id, {
          step: 'ready',
          isReindexing: false,
          chunkCount: idx.chunk_count,
          indexedChunks: idx.indexed_chunks,
          indexedTables: idx.indexed_tables,
          processedAt: new Date().toISOString(),
          error: undefined,
        })
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Reindexing failed'
        updateDoc(id, { step: 'error', isReindexing: false, error: msg })
        throw err
      }
    },
    [updateDoc],
  )

  return {
    documents,
    activeDocId,
    setActiveDocId,
    upload,
    removeDocument: deleteDoc,
    deleteDoc,
    reindexDoc,
  }
}
