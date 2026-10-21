const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface UploadResponse {
  status: string
  document_id: string
  filename: string
  size_bytes: number
  page_count: number
  character_count: number
  image_count: number
  table_count: number
  chunk_count?: number
  indexed_chunks?: number
  indexed_tables?: number
  images_metadata_file: string
  tables_metadata_file: string
  markdown_file: string
  metadata_file: string
  content_preview: string
  preview_truncated: boolean
  message: string
}

export interface IndexResponse {
  status: string
  document_id: string
  chunk_count: number
  indexed_chunks: number
  indexed_tables: number
  collection: string
  message: string
}

export interface AskResponse {
  answer: string
  sources: Array<{
    source: string
    document_id: string | null
    chunk_id: string | null
    chunk_index: number | null
    score: number | null
    page: number | null
    content_type: string
    text: string
    image_filename?: string
    vision_model?: string
  }>
  model: string
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (HTTP ${res.status})`)
  }
  return res.json()
}

export async function uploadDocument(
  file: File,
  onProgress?: (pct: number, step?: 'uploading' | 'extracting') => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/api/v1/documents/upload`)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100)
        onProgress(pct, pct >= 100 ? 'extracting' : 'uploading')
      }
    })

    xhr.upload.addEventListener('load', () => {
      if (onProgress) {
        onProgress(100, 'extracting')
      }
    })

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data)
        } else {
          reject(new Error(data.detail ?? `Upload failed (HTTP ${xhr.status})`))
        }
      } catch {
        reject(new Error(`Upload failed (HTTP ${xhr.status})`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('timeout', () =>
      reject(
        new Error(
          'Document processing timed out (exceeded 10 minutes). Please try again.',
        ),
      ),
    )
    xhr.timeout = 600000 // 10 minutes (generous window for CPU docling extraction)

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export async function indexDocument(documentId: string): Promise<IndexResponse> {
  const res = await fetch(`${BASE}/api/v1/documents/${documentId}/index`, {
    method: 'POST',
  })
  return handleResponse<IndexResponse>(res)
}

export async function reindexDocument(
  documentId: string,
  fullReprocess: boolean = false,
): Promise<IndexResponse> {
  const res = await fetch(
    `${BASE}/api/v1/documents/${documentId}/reindex?full_reprocess=${fullReprocess}`,
    {
      method: 'POST',
    },
  )
  return handleResponse<IndexResponse>(res)
}

export interface DeleteDocumentResponse {
  status: string
  document_id: string
  message: string
}

export async function deleteDocument(
  documentId: string,
): Promise<DeleteDocumentResponse> {
  const res = await fetch(`${BASE}/api/v1/documents/${documentId}`, {
    method: 'DELETE',
  })
  return handleResponse<DeleteDocumentResponse>(res)
}

export async function askQuestion(
  question: string,
  documentId?: string,
  limit = 5,
): Promise<AskResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  try {
    const res = await fetch(`${BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        document_id: documentId ?? null,
        limit,
      }),
      signal: controller.signal,
    })
    return handleResponse<AskResponse>(res)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export interface StoredDocumentMetadata {
  document_id: string
  original_filename: string
  size_bytes: number
  page_count: number
  character_count: number
  image_count: number
  table_count: number
  processed_at?: string
}

export async function listDocuments(): Promise<StoredDocumentMetadata[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/documents`, { method: 'GET' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
