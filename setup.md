# Anuvaad AI — Local Setup & Installation Guide

This guide provides step-by-step instructions to set up, configure, and run **Anuvaad AI** locally on your workstation (Windows, macOS, or Linux).

---

## 1. Prerequisites

Ensure the following tools are installed on your machine:

| Requirement | Recommended Version | Verification Command |
|---|---|---|
| **Python** | 3.10, 3.11, or 3.12 | `python --version` |
| **Node.js** | 18.x or 20.x LTS | `node -v` |
| **npm** | 9.x or 10.x | `npm -v` |
| **Git** | 2.x+ | `git --version` |
| **Groq API Key** | Free tier available | [console.groq.com](https://console.groq.com) |

> [!NOTE]
> No external database installation (like PostgreSQL, Redis, or Dockerized Qdrant) is required. Anuvaad AI uses an **embedded local persistent Qdrant instance** that runs directly within the repository filesystem.

---

## 2. Repository Setup

Clone the repository and inspect the folder structure:

```bash
git clone https://github.com/Aayushh910/Anuvaad-AI.git
cd Anuvaad-AI
```

The workspace consists of two primary directories:
- `backend/`: FastAPI application, Docling parser, vector store, and AI inference services.
- `frontend/`: React 19 + TypeScript + Vite web interface.

---

## 3. Backend Setup

### Step 3.1: Create a Python Virtual Environment
Navigate to the `backend/` folder and create an isolated virtual environment:

```bash
cd backend

# On Windows (PowerShell / Command Prompt)
python -m venv venv
.\venv\Scripts\activate

# On macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3.2: Install Backend Dependencies
With your virtual environment active, install all required packages:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> [!TIP]
> On the very first run, **Docling** and **sentence-transformers** will automatically download their lightweight model weights (`all-MiniLM-L6-v2` and layout weights) to your local cache (`~/.cache/huggingface/`). Ensure you have an active internet connection.

### Step 3.3: Configure Environment Variables
Create a `.env` file in the `backend/` root directory:

```bash
# On Windows
copy .env.example .env

# On macOS / Linux
cp .env.example .env
```

Open `backend/.env` in your editor and configure the keys:

```ini
# Application Metadata
APP_NAME=Multimodal PDF RAG Assistant
APP_ENV=development
API_V1_PREFIX=/api/v1

# Groq Cloud API Credentials (Required for QA & Vision)
GROQ_API_KEY=gsk_your_groq_api_key_here

# LLM Models
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=qwen/qwen3.6-27b

# Feature Flags
# Set to 'true' to asynchronously generate vision descriptions for extracted PDF charts/diagrams
DOCDUMIND_GENERATE_IMAGE_DESCRIPTIONS=true
```

### Step 3.4: Launch the Backend Server
Start the Uvicorn ASGI server with live reloading enabled:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Step 3.5: Verify Backend Health
Open your browser and navigate to:
- **API Root**: [http://localhost:8000/](http://localhost:8000/) $\rightarrow$ `{"status":"healthy","app":"Multimodal PDF RAG Assistant"}`
- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Probe**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 4. Frontend Setup

### Step 4.1: Install Dependencies
Open a new terminal window, navigate to the `frontend/` directory, and install the npm packages:

```bash
cd frontend
npm install
```

### Step 4.2: Configure Frontend Environment Variables
Ensure the `.env` file exists in `frontend/`:

```ini
VITE_API_URL=http://localhost:8000
```

### Step 4.3: Start the Vite Development Server
Run the local Vite development server:

```bash
npm run dev
```

You should see output similar to:
```
  VITE v8.3.0  ready in 420 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open your browser at **`http://localhost:5173`** to access the Anuvaad AI web application.

---

## 5. End-to-End Verification

Follow this quick sanity check to verify the full workflow:

1. **Upload a PDF**: Drag any technical document, financial report, or paper (under 25 MB) into the dropzone on `http://localhost:5173`.
2. **Observe Real-Time Stages**:
   - The UI will cycle dynamically through:
     1. `Uploading` (streaming file to `storage/uploads/`)
     2. `Extracting` (Docling extracting markdown text, tables, and images)
     3. `Chunking` (creating page-aware 800-character text segments)
     4. `Indexing` (generating MiniLM embeddings & upserting to Qdrant)
     5. `Ready` (chat interface unlocked)
3. **Ask Questions**:
   - **Text Query**: *"Summarize the primary conclusions of this document."*
   - **Table Query**: *"What is the value in column X of table Y?"*
   - **Visual Query**: *"What does the diagram on page 2 illustrate?"*
4. **Inspect Citations**: Verify that answers include clickable `[Source: Page X]` citation pills.
5. **Test Re-indexing & Deletion**:
   - Click the **Re-index** button in the sidebar or document card to reprocess vectors.
   - Click the **Delete** button, confirm via the inline `Delete? [✓] [✕]` prompt, and ensure vectors and artifacts are purged cleanly.

---

## 6. Troubleshooting & Common Pitfalls

### Issue 1: `AuthenticationError` or Groq API Refusal
- **Symptom**: Asking a question returns an error or empty answer stating API key is invalid.
- **Fix**: Check `backend/.env` and ensure `GROQ_API_KEY` is set to a valid key starting with `gsk_`. Restart the Uvicorn server after updating `.env`.

### Issue 2: Qdrant Database Lock (`portalocker.exceptions.AlreadyLocked`)
- **Symptom**: Backend startup or re-indexing throws:
  `LockError: File storage/qdrant/... is locked by another process`.
- **Cause**: Embedded Qdrant maintains an OS-level write lock. If multiple Uvicorn worker instances or test scripts access `storage/qdrant/` concurrently, the lock engages.
- **Fix**: 
  - Ensure only **one** instance of Uvicorn is running.
  - Terminate any dangling Python background processes:
    - On Windows: `Get-Process python | Stop-Process` (or kill via Task Manager).
    - On Linux/macOS: `pkill -f uvicorn`.

### Issue 3: Port 8000 or 5173 Already in Use
- **Symptom**: `[Errno 10048] error while attempting to bind on address ('127.0.0.1', 8000)`
- **Fix**:
  - Run the backend on an alternate port:
    ```bash
    python -m uvicorn app.main:app --reload --port 8001
    ```
  - Update `frontend/.env`:
    ```ini
    VITE_API_URL=http://localhost:8001
    ```

### Issue 4: First PDF Upload Takes ~50-60 Seconds
- **Observation**: The first upload appears to take longer than subsequent uploads.
- **Explanation**: This is expected behavior. On the first upload, Docling downloads and initializes layout neural network weights into memory. Subsequent uploads bypass this initialization.

---

## 7. Documentation Navigation

- 🏠 **[README.md](README.md)**: Master project overview, features, and architecture.
- 📘 **[docs/workflow.md](docs/workflow.md)**: Unified technical specification (Architecture, Multimodal RAG Pipeline, and End-to-End Workflow).
