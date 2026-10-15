export type ProcessingStep =
  | 'uploading'
  | 'extracting'
  | 'chunking'
  | 'indexing'
  | 'ready'
  | 'error'

export interface Document {
  id: string
  filename: string
  sizeBytes: number
  pageCount: number
  characterCount: number
  imageCount: number
  tableCount: number
  processedAt: string
  step: ProcessingStep
  chunkCount?: number
  indexedChunks?: number
  indexedTables?: number
  error?: string
}

export interface Source {
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
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  model?: string
  timestamp: number
}

export const STEP_LABELS: Record<ProcessingStep, string> = {
  uploading: 'Uploading',
  extracting: 'Extracting Content',
  chunking: 'Creating Chunks',
  indexing: 'Indexing',
  ready: 'Ready',
  error: 'Error',
}

export const STEP_ORDER: ProcessingStep[] = [
  'uploading',
  'extracting',
  'chunking',
  'indexing',
  'ready',
]
