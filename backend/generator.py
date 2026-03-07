"""Generate slide content using Groq (Llama)."""

import json
import os
from typing import Optional

from groq import Groq


def generate_slides(
    prompt: str,
    tone: str = "professional",
    slide_count: int = 10,
    theme_color: Optional[str] = None,
) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set")

    client = Groq(api_key=api_key)

    system_instr = """You are a world-class presentation and visual designer. Create a complete, premium presentation spec.
Return ONLY valid JSON with this exact structure (no markdown, no prose):

{
  "deck_title": "Short premium deck title",
  "theme": {
    "bg": [r, g, b],
    "accent": [r, g, b],
    "accent2": [r, g, b],
    "title_color": [r, g, b],
    "body_color": [r, g, b],
    "shape_color": [r, g, b],
    "title_font": "Montserrat",
    "body_font": "Lato"
  },
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["bullet 1", "bullet 2"],
      "image_query": "cinematic search query for Pexels",
      "layout": "title|content|section|closing|quote|statistic"
    }
  ]
}

Rules:
- deck_title: short, human-readable title that captures the key details of the topic.
  Do NOT just repeat the user prompt. Maximum 80 characters.
- bg, accent, accent2, title_color, body_color, shape_color: RGB arrays 0-255
- First slide: layout "title"
- Last slide: layout "closing"
- Use "section" every ~5 slides, "content" for most
- image_query: short cinematic phrase for stock photos.
  It MUST be highly specific to the topic and slide content (e.g. '1870s canadian parliament chamber illustration',
  'futuristic operating room with medical AI monitors', 'modern startup team pitching to investors').
  Never use vague or generic queries like 'business people', 'timeline', 'technology', 'abstract background'.
  If no clearly relevant image exists, set image_query to an empty string for that slide.
- Match the requested tone in wording and style
- ALWAYS choose a premium, cohesive visual theme that fits the topic domain:
  - Historic topics: warm parchment-like, maps, serif titles (similar quality to a museum-grade history deck)
  - Scientific/technical topics: clean, high-contrast, lab / circuitry / data-driven, very modern
  - Corporate/startup topics: bold gradients, sharp typography, minimal clutter
- If the user provides a hex theme color, softly base the palette around it (without breaking contrast or readability).
- Overall craft level should match a professionally designed slide deck (for example, a premium history deck about
  'The Pacific Scandal' from 1872–1873), while still adapting the visual language to the specific topic."""

    user_content = (
        f"Topic: {prompt}\n"
        f"Tone: {tone}\n"
        f"Number of slides: {slide_count}\n"
        f"Preferred primary hex theme color: {theme_color or 'none'}\n"
        "Design direction: Make the slides feel extremely premium and tailored to the topic, "
        "matching the quality of a professionally art-directed deck."
    )

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You output ONLY valid JSON. No prose. No markdown."},
            {"role": "user", "content": f"{system_instr}\n\n{user_content}"},
        ],
        response_format={"type": "json_object"},
    )

    raw = completion.choices[0].message.content
    data = json.loads(raw)

    if "slides" not in data or not data["slides"]:
        raise ValueError("Generated content has no slides")

    return data
