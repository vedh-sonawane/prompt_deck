"""
FastAPI backend for the AI Presentation Generator.
POST /generate accepts prompt, tone, and slide_count; returns created presentation info.
"""

from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend directory so GEMINI_API_KEY is available
load_dotenv(Path(__file__).resolve().parent / ".env")

from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from auth_manager import get_credentials
from generator import generate_slides
from slide_builder import SlideManager

# Build Google Slides API service once at startup (optional; can be created per-request)
_slides_service: Optional[Any] = None


def get_slides_service():  # -> Resource
    global _slides_service
    if _slides_service is None:
        try:
            from googleapiclient.discovery import build
            creds = get_credentials()
            _slides_service = build("slides", "v1", credentials=creds)
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=503,
                detail="Google credentials not configured. Add credentials.json to the backend directory.",
            ) from e
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to initialize Google Slides service: {e}",
            ) from e
    return _slides_service


app = FastAPI(
    title="Slidetech API",
    description="AI Presentation Generator backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    """Request body for POST /generate."""

    prompt: str = Field(..., min_length=1, description="Presentation topic or description")
    tone: str = Field(default="professional", description="Tone of voice (e.g. professional, casual)")
    slide_count: int = Field(default=10, ge=3, le=60, description="Number of slides (3–60)")


class GenerateResponse(BaseModel):
    """Response after successful deck creation."""

    presentation_id: str
    message: str = "Presentation created successfully."


@app.post("/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest) -> GenerateResponse:
    print(f"--- Generate request received for: {request.prompt} ---")
    try:
        # 1) Generate slide content
        print("Starting content generation with Groq...")
        content = generate_slides(
            prompt=request.prompt,
            tone=request.tone,
            slide_count=request.slide_count,
        )
        print("Content generation successful!")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"Content generation failed: {e}")

    try:
        service = get_slides_service()
    except HTTPException:
        raise

    try:
        manager = SlideManager(service)
        p_prompt: str = str(request.prompt)
        presentation_title = p_prompt[:50] if p_prompt else "Presentation"
        presentation = manager.build_deck(
            title=presentation_title,
            content=content,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create Google Slide deck: {e}",
        ) from e

    presentation_id: str = (presentation or {}).get("presentationId", "")
    if not presentation_id:
        raise HTTPException(
            status_code=502,
            detail="Slides API did not return a presentation ID.",
        )

    return GenerateResponse(**{
        "presentation_id": presentation_id,
        "message": "Presentation created successfully.",
    })


@app.get("/health")
def health() -> Dict[str, str]:
    """Health check for load balancers and monitoring."""
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
