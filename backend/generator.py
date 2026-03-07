"""Generate slide content using Groq (Llama)."""

import json
import os
from groq import Groq


def generate_slides(
    prompt: str,
    tone: str = "professional",
    slide_count: int = 10,
) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set")

    client = Groq(api_key=api_key)

    system_instr = """You are a World-Class Graphic Designer. Create a complete presentation spec.
Return ONLY valid JSON with this exact structure (no markdown, no prose):

{
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
- bg, accent, accent2, title_color, body_color, shape_color: RGB arrays 0-255
- First slide: layout "title"
- Last slide: layout "closing"
- Use "section" every ~5 slides, "content" for most
- image_query: short cinematic phrase for stock photos
- Match the requested tone in wording and style"""

    user_content = f"Topic: {prompt}\nTone: {tone}\nNumber of slides: {slide_count}"

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
