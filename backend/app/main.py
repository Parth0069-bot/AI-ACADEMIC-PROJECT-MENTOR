"""
AI Academic Project Mentor — Backend
Milestone 2, Task 1: Feasibility Analysis Agent (complete, all 7 steps)

Run locally with:
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings, supabase_is_configured
from app.routers import (
    debug,
    agents,
    ideas,
    mentor,
    documents,
    faculty,
    viva_studio,
    embeddings,
    graph_review,
    model_router,
    evaluation,
)

app = FastAPI(
    title="AI Academic Project Mentor — Backend",
    description="FastAPI backend for the multi-agent project mentor pipeline (Milestone 2).",
    version="0.1.0",
)

# Without this, the frontend (running on a different origin,
# localhost:3000 vs this server's localhost:8000) gets silently
# blocked by the browser on every fetch() call — CORS errors don't
# even reach our code, so this has to be configured here, not "fixed"
# on the frontend side.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.app_env == "development":
    app.include_router(debug.router)
app.include_router(agents.router)
app.include_router(ideas.router)
app.include_router(mentor.router)
app.include_router(documents.router)
app.include_router(faculty.router)
app.include_router(viva_studio.router)
app.include_router(embeddings.router)
app.include_router(graph_review.router)
app.include_router(model_router.router)
app.include_router(evaluation.router)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    """
    Turns "a service isn't configured yet" errors into a clear 503
    response instead of a raw 500 — matters most while setting up .env.
    """
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc)},
    )


@app.get("/", tags=["health"])
def root():
    return {"message": "AI Academic Project Mentor backend is running."}


@app.get("/health", tags=["health"])
def health_check():
    """
    Reports whether required services are configured — useful for
    confirming your .env is set up correctly before building further.
    """
    return {
        "status": "ok",
        "environment": settings.app_env,
        "supabase_configured": supabase_is_configured(),
        "gemini_configured": bool(settings.gemini_api_key),
        "frontend_origin_allowed": settings.frontend_origin,
    }
