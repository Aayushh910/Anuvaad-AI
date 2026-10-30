import os
import re
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from app.services.vector_store import search_documents

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


INSUFFICIENT_EVIDENCE_PHRASES = (
    # General lack of evidence or information
    "i don't have enough information",
    "i do not have enough information",
    "not enough information",
    "insufficient information",
    "not enough evidence",
    "insufficient evidence",
    "context does not contain enough evidence",
    "context does not provide enough evidence",
    "does not contain enough evidence",
    "does not provide sufficient evidence",
    "does not contain sufficient evidence",

    # Answers that cannot be determined or provided
    "cannot be determined from",
    "cannot be answered from",
    "cannot determine this from the supplied information",
    "cannot answer based on the provided",
    "cannot be answered based on the provided",
    "cannot be answered using the provided",
    "unable to answer based on",

    # Requested information is missing or out of context
    "does not provide the requested information",
    "does not contain the information needed",
    "does not contain the information required",
    "does not contain any information",
    "does not provide enough information",
    "does not contain enough information",
    "does not state the exact number",
    "does not state the exact total",
    "does not give the breakdown",
    "does not provide the breakdown",

    # Explicit document or source limitations
    "the document does not state",
    "the provided document does not state",
    "the provided text does not state",
    "document does not mention",
    "provided document does not mention",
    "context does not mention",
    "not mentioned in the document",
    "not mentioned in the provided",
    "not mentioned in the context",
    "not mentioned anywhere in",
    "not found in the document",
    "not found in the provided document",
    "not found in the supplied context",
    "not found in the context",
    "not in the document",
    "out of context",
    "outside the context",
    "outside the scope of the document",
    "no information about",
    "no information provided about",
    "no information regarding",
    "no mention of",
    "not available from the provided context",
    "not available from the supplied sources",
    "is not available in the document",
    "cannot be provided from the supplied sources",
    "is not covered in the document",
    "not covered in the provided",
)


def normalize_relevance_score(raw_score: float | None) -> float | None:
    """Normalize raw cosine similarity into a comfortable human percentage."""
    if raw_score is None:
        return None
    try:
        score = float(raw_score)
    except (TypeError, ValueError):
        return None

    if score >= 0.75:
        scaled = 0.95 + min(0.04, (score - 0.75) * 0.15)
    elif score >= 0.55:
        scaled = 0.88 + (score - 0.55) / 0.20 * 0.07
    elif score >= 0.40:
        scaled = 0.80 + (score - 0.40) / 0.15 * 0.08
    elif score >= 0.28:
        scaled = 0.70 + (score - 0.28) / 0.12 * 0.10
    else:
        scaled = max(0.40, score * 1.8)

    return round(min(0.99, max(0.40, scaled)), 3)


def _strip_citations(text: str) -> str:
    """Remove any [S1], [S2] citation markers from text when answer is unsupported or out of context."""
    cleaned = re.sub(r"\s*\[S\s*\d+\]", "", text)
    cleaned = re.sub(r" +", " ", cleaned)
    return cleaned.strip()


def _has_insufficient_evidence(
    answer: str,
    max_source_index: int | None = None,
) -> bool:
    """Check whether the generated answer indicates insufficient context or out-of-context question."""
    normalized = answer.lower()
    if any(phrase in normalized for phrase in INSUFFICIENT_EVIDENCE_PHRASES):
        return True

    if max_source_index is not None:
        cited_sources = [
            int(num) for num in re.findall(r"\[S\s*(\d+)\]", answer, re.IGNORECASE)
        ]
        if any(src_num > max_source_index for src_num in cited_sources):
            return True

    return False


def _is_answer_supported(
    answer: str,
    sources: list[dict],
    llm,
) -> bool:
    """Check whether claims in the answer are supported by retrieved evidence."""
    if not answer.strip() or not sources:
        return False

    evidence = "\n\n".join(
        f"[{source['source']}]\n{source.get('text', '')}"
        for source in sources
    )

    messages = [
        SystemMessage(
            content=(
                "You are a strict evidence-grounding evaluator. "
                "Check whether every factual claim in the answer is supported by the supplied evidence. "
                "If any material claim is unsupported or contradicted, respond UNSUPPORTED. "
                "Otherwise respond SUPPORTED. Return only one of these two words."
            )
        ),
        HumanMessage(
            content=(
                f"Evidence:\n{evidence}\n\n"
                f"Answer to evaluate:\n{answer}"
            )
        ),
    ]

    try:
        response = llm.invoke(messages)
        verdict = str(response.content).strip().upper()
        return verdict == "SUPPORTED"
    except Exception:
        return False


def _build_prompt_messages(question: str, context: str) -> list:
    """Build system and human messages for answering."""
    return [
        SystemMessage(
            content=(
                "Answer only from the provided context (document text and image transcriptions). "
                "If the answer is not in the context, say so clearly. Do not guess or use outside knowledge. "
                "Do not invent facts, sources, or page numbers. "
                "Cite supporting evidence using source labels such as [S1] or [S2] only when directly supported. "
                "If the context does not contain the answer, state that clearly and do NOT cite any sources."
            )
        ),
        HumanMessage(
            content=(
                f"Question:\n{question}\n\n"
                f"Context:\n{context}\n\n"
                "Answer the question accurately using only the provided context. If supported, include source labels."
            )
        ),
    ]


def generate_answer(
    question: str,
    document_id: str | None = None,
    limit: int | None = None,
) -> dict:
    """Generate an answer grounded in retrieved document and image chunks."""

    if not question.strip():
        raise ValueError("Question cannot be empty.")

    if limit is None:
        limit = int(os.getenv("RETRIEVAL_TOP_K", "5"))

    # Retrieve relevant chunks from Qdrant.
    results = search_documents(
        query=question,
        limit=limit,
        document_id=document_id,
    )

    if not results:
        return {
            "answer": "I couldn't find relevant information in the indexed documents.",
            "sources": [],
            "model": MODEL_NAME,
        }

    # Format retrieved chunks and metadata
    context_parts = []
    sources = []

    for index, result in enumerate(results, start=1):
        source_label = f"S{index}"
        text = result.get("text", "")
        metadata = result.get("metadata") or {}

        page_val = (
            metadata.get("page_or_slide_or_sheet")
            or metadata.get("page_number")
            or metadata.get("page")
            or metadata.get("sheet_name")
            or "1"
        )
        content_type = metadata.get("content_type", "text")
        filename = metadata.get("filename") or "Document"
        raw_score = result.get("score")
        norm_score = normalize_relevance_score(raw_score)

        context_parts.append(
            f"[{source_label}]\n"
            f"Source: {filename}\n"
            f"Location: {page_val}\n"
            f"Content Type: {content_type}\n"
            f"Content:\n{text}"
        )

        sources.append({
            "source": source_label,
            "document_id": result.get("document_id"),
            "filename": filename,
            "page_or_slide_or_sheet": page_val,
            "page": page_val,
            "content_type": content_type,
            "score": norm_score,
            "text": text,
        })

    llm = ChatGroq(
        model=MODEL_NAME,
        temperature=0,
        max_tokens=1200,
    )

    context = "\n\n".join(context_parts)
    messages = _build_prompt_messages(question, context)
    response = llm.invoke(messages)
    answer = response.content if isinstance(response.content, str) else str(response.content)

    # Check if model indicates out-of-context or insufficient evidence
    if _has_insufficient_evidence(answer, len(sources)):
        return {
            "answer": _strip_citations(answer),
            "sources": [],
            "model": MODEL_NAME,
        }

    # If specific citations [S1] were used, filter sources to only the cited ones
    cited_nums = set(
        int(num) for num in re.findall(r"\[S\s*(\d+)\]", answer, re.IGNORECASE)
    )
    filtered_sources = [
        s for s in sources if int(s["source"][1:]) in cited_nums
    ] if cited_nums else sources

    return {
        "answer": answer,
        "sources": filtered_sources,
        "model": MODEL_NAME,
    }
