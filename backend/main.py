"""
FastAPI backend for the AI Presentation Generator.
POST /generate accepts prompt, tone, and slide_count; returns created presentation info.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import json
import secrets

from dotenv import load_dotenv

# Load .env from backend directory so GEMINI_API_KEY is available
load_dotenv(Path(__file__).resolve().parent / ".env")


USERS_FILE = Path(__file__).resolve().parent / "users.json"


def _load_users() -> List[Dict[str, Any]]:
    if not USERS_FILE.exists():
        return []
    try:
        with USERS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def _save_users(users: List[Dict[str, Any]]) -> None:
    try:
        with USERS_FILE.open("w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
    except Exception:
        # In a local/dev setting we can just log; FastAPI will still run
        print("Warning: failed to write users.json")


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


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
    theme_color: Optional[str] = Field(
        default=None,
        description="Optional primary theme color as hex, e.g. #c8b49a",
    )


class GenerateResponse(BaseModel):
    """Response after successful deck creation."""

    presentation_id: str
    title: str
    tone: str
    slide_count: int
    message: str = "Presentation created successfully."


class UserPublic(BaseModel):
    """Public user information returned after auth."""

    id: str
    name: str
    email: str


class SignupRequest(BaseModel):
    """Request body for POST /auth/signup."""

    name: str = Field(..., min_length=1, description="Display name")
    email: str = Field(..., min_length=3, description="Email address")
    password: str = Field(..., min_length=6, description="Password")


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""

    email: str = Field(..., min_length=3, description="Email address")
    password: str = Field(..., min_length=6, description="Password")


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
            theme_color=request.theme_color,
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
        raw_title = str(content.get("deck_title") or "").strip()
        if not raw_title:
            raw_title = str(request.prompt)
        # Keep titles reasonably short for Slides UI
        presentation_title = (raw_title[:70]).strip() if raw_title else "Presentation"
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

    return GenerateResponse(
        presentation_id=presentation_id,
        title=presentation_title,
        tone=request.tone,
        slide_count=request.slide_count,
        message="Presentation created successfully.",
    )


@app.post("/auth/signup", response_model=UserPublic)
def signup(request: SignupRequest) -> UserPublic:
    """Create a simple local user account stored in users.json.

    This is intentionally lightweight and suitable for a local/dev environment.
    Passwords are hashed with SHA-256 plus a per-user salt.
    """
    email_normalized = request.email.strip().lower()
    users = _load_users()
    if any(u.get("email") == email_normalized for u in users):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    salt = secrets.token_hex(16)
    password_hash = _hash_password(request.password, salt)
    user_id = secrets.token_hex(8)

    user_record = {
        "id": user_id,
        "name": request.name.strip(),
        "email": email_normalized,
        "password_hash": password_hash,
        "salt": salt,
    }
    users.append(user_record)
    _save_users(users)

    return UserPublic(id=user_id, name=user_record["name"], email=user_record["email"])


@app.post("/auth/login", response_model=UserPublic)
def login(request: LoginRequest) -> UserPublic:
    """Authenticate a user using the stored credentials."""
    email_normalized = request.email.strip().lower()
    users = _load_users()
    user = next((u for u in users if u.get("email") == email_normalized), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    salt = user.get("salt") or ""
    expected_hash = user.get("password_hash") or ""
    if _hash_password(request.password, salt) != expected_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return UserPublic(id=user["id"], name=user["name"], email=user["email"])


@app.get("/health")
def health() -> Dict[str, str]:
    """Health check for load balancers and monitoring."""
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
