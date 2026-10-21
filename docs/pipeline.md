# Anuvaad AI — Multimodal RAG Pipeline Deep Dive

This document details the complete Retrieval-Augmented Generation (RAG) pipeline implemented in **Anuvaad AI** (DocuMind). It explains **what** components are used, **why** they were selected, and **what alternatives were evaluated or tried** during development.

---

## 1. Pipeline Overview Diagram

```mermaid
flowchart TD
    subgraph Ingestion_Stage ["1. Multimodal Parsing & Ingestion"]
        PDF[Uploaded PDF Document] --> DoclingEngine[Docling Document Converter]
        PDF --> PyMuPDFEngine[PyMuPDF Image Extractor]
        
        DoclingEngine --> MarkdownText[Structured Hierarchical Markdown]
        DoclingEngine --> PageMap[Page-Provenance Text Mapping]
        DoclingEngine --> TableGrids[2D Structured Tables]
        PyMuPDFEngine --> RasterImages[Filtered PNG Images]
    end

    subgraph Transformation_Stage ["2. Page-Aware Chunking & Table Encoding"]
        PageMap --> TextChunker[RecursiveCharacterTextSplitter\n800 chars / 120 overlap\nStrict Page Boundaries]
        TableGrids --> TableSerializer[Markdown Table Formatter\n| Header 1 | Header 2 |]
        
        TextChunker --> UnifiedChunks[Unified Searchable Chunks]
        TableSerializer --> UnifiedChunks
    end

    subgraph Vectorization_Stage ["3. Dense Embedding & Vector Store"]
        UnifiedChunks --> EmbedModel[SentenceTransformer\n'all-MiniLM-L6-v2'\n384 Dimensions]
        EmbedModel --> QdrantDB[(Qdrant Vector Database\nCollection: 'pdf_chunks'\nCosine Distance + Doc Filtering)]
    end

    subgraph Retrieval_Stage ["4. Multimodal Retrieval & Re-ranking"]
        UserQuery[User Question] --> QueryEmbed[Embed Query]
        QueryEmbed --> QdrantSearch[Qdrant Semantic Search\nTop-5 Nearest Text/Table Chunks]
        
        UserQuery --> ImageRanker[Heuristic Keyword Ranker\nQuery vs Figure Captions]
        ImageRanker --> VisionGate{High Image Relevance?}
        VisionGate -->|Yes| GroqVision[Groq Vision API\nqwen/qwen3.6-27b]
        VisionGate -->|No| NoVision[Skip Vision]
    end

    subgraph Generation_Stage ["5. Grounded Generation & Citation"]
        QdrantSearch --> ContextAssembler[Context Assembler]
        GroqVision --> ContextAssembler
        NoVision --> ContextAssembler
        
        ContextAssembler --> LLM[Groq Cloud LLM\nllama-3.3-70b-versatile]
        LLM --> CitationGuard[Evidence & Citation Audit]
        CitationGuard --> FinalAnswer[Answer with Page Citations]
    end
```

---

## 2. Stage-by-Stage Design Choices & Alternatives

### Stage 1: Document Parsing & Layout Analysis

#### What We Use:
- **Docling** (`docling.document_converter.DocumentConverter`) for document structure and table extraction.
- **PyMuPDF (`fitz`)** for rapid visual raster image extraction.

#### Why We Chose It:
- **Hierarchical Layout Preservation**: PDFs are not flat text streams; they contain headers, lists, columns, footnotes, and tables. Naive extraction scrambles columns. Docling uses advanced vision-based layout models to output clean, structured Markdown that retains reading order.
- **Direct Table Understanding**: Docling outputs cell-level table grids, preserving rows, headers, and column spans that traditional PDF parsers destroy.
- **Accurate Provenance**: Docling tracks bounding boxes and provenance (`item.prov`), enabling exact mapping of text segments to their source PDF page numbers.

#### Alternatives Evaluated & Why They Were Rejected:
| Tool Evaluated | What Was Observed | Why Rejected / Replaced |
|---|---|---|
| **PyPDF / pypdf** | Very fast ($<1$ sec) text extraction. | Completely scrambled multi-column text, merged table cells into unreadable sentences, and dropped all visual elements. |
| **pdfplumber** | Good coordinate tracking and decent table extraction. | Extremely slow on complex multi-page PDFs; struggled to distinguish complex headers and produced no cohesive Markdown hierarchy. |
| **Unstructured.io** | Broad format support and element detection. | Heavy dependency footprint (multi-gigabyte Docker images required for OCR models); slow startup and high memory overhead for local execution. |
| **PyMuPDF alone (`fitz`)** | Blazing-fast image extraction and text dumping. | Lacks semantic document layout understanding. We retained PyMuPDF solely for extracting raster images, while Docling handles layout and tables. |

---

### Stage 2: Chunking Strategy

#### What We Use:
- **Page-Aware Recursive Character Text Splitter** with:
  - `chunk_size = 800` characters
  - `chunk_overlap = 120` characters
  - `separators = ["\n## ", "\n### ", "\n\n", "\n", " ", ""]`
- **Isolated Table Chunking**: Tables are formatted directly into Markdown tables and indexed as individual self-contained chunks.

#### Why We Chose It:
- **Boundary Integrity**: By running chunking **page by page**, we eliminate cross-page semantic bleeding. A paragraph on Page 2 will never accidentally merge with a header on Page 3.
- **Verifiable Citations**: Every single chunk is tagged with its originating `page_number`. When a chunk is retrieved, the citation is 100% deterministic.
- **Table Preservation**: Converting tables into Markdown grids (`| Year | Revenue |`) ensures LLMs can read rows and columns as structured relational data rather than unstructured comma-separated fragments.

#### Alternatives Evaluated & Why They Were Rejected:
| Strategy Evaluated | What Was Observed | Why Rejected |
|---|---|---|
| **Fixed-Size Token Chunking (e.g., 512 tokens)** | Chunks cut mid-sentence and mid-table. | Ruined table rows, split numbers from their column headers, and caused hallucinations when numbers lost their context. |
| **Sentence-Window Retrieval** | High granularity for single facts. | Failed completely on tables and multi-step procedural paragraphs where wider context is essential. |
| **Document-Level Whole Text Feeding** | Fed full markdown into a 128k context LLM. | Extremely high per-query latency and token cost; suffered from the classic "lost-in-the-middle" phenomenon on long reports. |

---

### Stage 3: Embedding Model & Vector Storage

#### What We Use:
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
- **Vector Database**: **Qdrant** (Embedded local persistent client, Cosine distance).

#### Why We Chose It:
- **Zero Cost & Offline Execution**: `all-MiniLM-L6-v2` runs locally on the CPU with sub-millisecond per-chunk encoding times and zero external API costs or rate limits.
- **Optimized for Information Retrieval**: Despite its compact size (80 MB model), MiniLM ranks exceptionally well on the MTEB benchmark for sentence semantic similarity.
- **Payload Filtering in Qdrant**: Qdrant enables instantaneous filtered searches via `FieldCondition(key="document_id", match=MatchValue(value=document_id))`. This guarantees that user queries only search chunks belonging to their active document.
- **Embedded Persistence**: Qdrant runs directly on disk inside `storage/qdrant/` without requiring external Docker containers or cloud subscriptions for local developers.

#### Alternatives Evaluated & Why They Were Rejected:
| Technology Evaluated | What Was Observed | Why Rejected |
|---|---|---|
| **OpenAI `text-embedding-3-small`** | 1536-dim embeddings with good semantic quality. | Added recurring API billing; added network latency to chunking; failed when offline or behind firewalls. |
| **ChromaDB** | Popular open-source vector store. | Encountered SQLite thread concurrency issues during rapid upload/indexing cycles, and SQLite telemetry dependencies. |
| **FAISS** | Extremely fast in-memory similarity search. | Lacks native document-level payload filtering and persistent CRUD operations; deleting vectors by document ID requires full index rebuilding. |
| **Pinecone** | Managed cloud vector database. | Cloud-only; requires an API key and network connectivity; unnecessary infrastructure overhead for standalone or local deployment. |

---

### Stage 4: Multimodal Vision Integration

#### What We Use:
- **Groq Vision API** powered by `qwen/qwen3.6-27b` (or Llama 3.2 Vision).
- **FastAPI `BackgroundTasks`** for asynchronous image enrichment.
- **Heuristic Image Ranker** (`app/services/image_retrieval.py`) for on-demand query inspection.

#### Why We Chose It:
- **Solves the Multimodal Blind Spot**: Many PDF documents (e.g., earnings reports, whitepapers, engineering specs) present their most critical data exclusively inside charts, bar graphs, and architecture diagrams. Pure text RAG completely misses these insights.
- **Asynchronous Decoupling**: Extracting and describing 10 images synchronously during upload added $\approx 100$ seconds of blocking remote API calls, causing the frontend to time out. Moving image descriptions to background workers cut upload time from **150s to ~50s**.
- **On-Demand Inspection**: When a user asks a visual question ("What does the architecture diagram show?"), the image ranker isolates the candidate image and Groq Vision performs targeted reasoning.

#### Alternatives Evaluated & Why They Were Rejected:
| Approach Evaluated | What Was Observed | Why Rejected |
|---|---|---|
| **Synchronous Vision on Upload** | Described every image before returning 200 OK. | Caused upload requests to exceed 2 minutes, triggering HTTP timeouts and leaving vector stores unindexed. |
| **Local Tesseract OCR on Images** | Extracted raw text inside charts. | Lost all visual relationships (arrows, pie slices, bar heights, trend lines) and produced garbled text fragments. |
| **Local LLaVA / Vision LLM** | Accurate local vision reasoning. | Required 16+ GB of VRAM; ran at $<1$ token/sec on standard developer laptops without dedicated GPUs. |

---

### Stage 5: Inference, Grounding & Hallucination Mitigation

#### What We Use:
- **LLM Engine**: Groq Cloud LLM (`llama-3.3-70b-versatile` / `openai/gpt-oss-120b`).
- **Prompt Engineering**: Strict context grounding with page citation enforcement.
- **Self-Healing Fallback**: Automated vectorization if queries hit unindexed documents.

#### Why We Chose It:
- **Incredible Speed**: Groq's LPU (Language Processing Unit) architecture delivers responses at $\mathbf{>250}$ **tokens per second**, rendering complete answers with citations in under 1 second.
- **Strict Evidence Audit**:
  - The system prompt forbids the LLM from relying on outside pre-training knowledge when answering document questions.
  - Mandatory citation format: `[Source: Page X]`.
  - Defined fallback phrases (e.g., *"The provided document does not contain information about..."*) are monitored to prevent subtle hallucinations.

---

## 3. Technology Decision Matrix

| Dimension | Chosen Solution | Primary Alternative | Deciding Advantage |
|---|---|---|---|
| **PDF Extraction** | **Docling** | PyPDF / pdfplumber | Preserves multi-column layout, markdown headers, and table grids |
| **Embeddings** | **all-MiniLM-L6-v2** | OpenAI text-embedding-3 | Zero cost, runs locally on CPU, no rate limits, 384 dimensions |
| **Vector DB** | **Qdrant (Embedded)** | Chroma / FAISS | Native payload filtering on `document_id`, persistent, zero Docker overhead |
| **Vision Reasoning**| **Groq Qwen 3.6 27B** | Local LLaVA | 2-second visual inference vs 45-second local CPU execution |
| **Text Generation** | **Groq Llama 3.3 70B**| Local Ollama | $>250$ tokens/sec latency vs 8 tokens/sec on local machine |
| **Vision Timing** | **Async BackgroundTasks** | Synchronous Upload | 67% reduction in upload latency (50s vs 150s) |
