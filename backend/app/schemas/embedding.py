"""
Schemas for document chunking, embedding, and semantic search.
"""

from pydantic import BaseModel, Field


class ChunkRecord(BaseModel):
    """One stored chunk, as returned to the API caller (no vector)."""

    chunk_index: int
    content: str
    token_count: int


class ProcessDocumentRequest(BaseModel):
    """
    Optional body for POST /embeddings/process/{document_type}/{idea_id}.

    If `text` is omitted, the service will pull the latest stored DOCX
    for that idea_id + document_type from Supabase Storage and extract
    its text automatically.
    """

    text: str | None = Field(
        default=None,
        description="Raw text to chunk and embed. If omitted, the "
        "latest stored document of this type is fetched and its text "
        "extracted instead.",
    )


class ProcessDocumentResponse(BaseModel):
    idea_id: str
    document_id: str | None
    document_type: str
    chunks_stored: int
    model: str
    dimensions: int


class SemanticSearchRequest(BaseModel):
    idea_id: str
    query: str
    match_count: int = Field(default=5, ge=1, le=50)
    document_type: str | None = Field(
        default=None,
        description="Optional filter, e.g. 'synopsis' or 'progress_report'.",
    )


class SemanticSearchResult(BaseModel):
    id: str
    idea_id: str
    document_id: str | None
    document_type: str
    chunk_index: int
    content: str
    similarity: float


class SemanticSearchResponse(BaseModel):
    query: str
    results: list[SemanticSearchResult]
