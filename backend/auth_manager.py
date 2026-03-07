"""
Google OAuth 2.0 credential management for Google Slides API.
Uses token.json if valid; otherwise runs OAuth flow with credentials.json.
"""

from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/presentations.readonly",
    "https://www.googleapis.com/auth/drive.file",
]

DEFAULT_CREDENTIALS_PATH = Path(__file__).resolve().parent / "credentials.json"
DEFAULT_TOKEN_PATH = Path(__file__).resolve().parent / "token.json"


def get_credentials(
    credentials_path: Optional[Path] = None,
    token_path: Optional[Path] = None,
) -> Credentials:
    credentials_path = credentials_path or DEFAULT_CREDENTIALS_PATH
    token_path = token_path or DEFAULT_TOKEN_PATH

    creds: Optional[Credentials] = None

    try:
        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    except (ValueError, OSError):
        creds = None
        try:
            token_path.unlink(missing_ok=True)
        except OSError:
            pass

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not credentials_path.exists():
                raise FileNotFoundError(
                    f"credentials.json not found at {credentials_path}. "
                    "Download from Google Cloud Console and place in backend/"
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(credentials_path), SCOPES
            )
            creds = flow.run_local_server(port=8080)

        try:
            with open(token_path, "w") as f:
                f.write(creds.to_json())
        except OSError as e:
            raise IOError(f"Could not save token to {token_path}: {e}") from e

    return creds
