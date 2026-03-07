"""Build Google Slides presentations from content spec."""

import os
import requests
from typing import Any, Dict, List, Optional
from googleapiclient.discovery import Resource

EMU = 914400


def _rgb(r: int, g: int, b: int) -> Dict[str, float]:
    return {"red": r / 255, "green": g / 255, "blue": b / 255}


def _emu(inches: float) -> int:
    return int(inches * EMU)


def _oid(prefix: str, idx: int) -> str:
    raw = f"{prefix}_{idx:04d}"
    return raw if len(raw) >= 5 else raw + "_pad"


def _get_image_url(query: str, pexels_key: str) -> Optional[str]:
    if not pexels_key or not query:
        return None
    try:
        res = requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": pexels_key},
            params={"query": query, "per_page": 1, "orientation": "landscape"},
            timeout=5,
        )
        data = res.json()
        photos = data.get("photos", [])
        if photos:
            return photos[0]["src"]["large"]
    except Exception:
        pass
    return None


def _parse_theme(t: Dict) -> Dict:
    def rgb(key: str, default: List[int]):
        v = t.get(key, default)
        if isinstance(v, list) and len(v) == 3:
            return tuple(v)
        return tuple(default)

    return {
        "bg": rgb("bg", [15, 23, 42]),
        "accent": rgb("accent", [251, 191, 36]),
        "accent2": rgb("accent2", [253, 220, 100]),
        "title": rgb("title_color", [255, 255, 255]),
        "body": rgb("body_color", [203, 213, 225]),
        "shape": rgb("shape_color", [40, 60, 100]),
        "title_font": t.get("title_font", "Montserrat"),
        "body_font": t.get("body_font", "Lato"),
    }


def _slide_layout(i: int, total: int) -> str:
    if i == 0:
        return "title"
    if i == total - 1:
        return "closing"
    if i % 5 == 0:
        return "section"
    return "content"


class SlideManager:
    def __init__(self, service: Resource) -> None:
        self._service = service
        self._pexels_key = os.getenv("PEXELS_API_KEY", "")

    def build_deck(
        self,
        title: str,
        content: Dict[str, Any],
        prompt: str = "",
    ) -> Dict[str, Any]:
        slides = content.get("slides", [])
        theme_data = content.get("theme", {})
        if not slides:
            raise ValueError("Content must contain at least one slide")

        theme = _parse_theme(theme_data) if theme_data else _parse_theme({})

        presentation = self._service.presentations().create(body={"title": title}).execute()
        presentation_id = presentation.get("presentationId")
        if not presentation_id:
            raise ValueError("Slides API did not return a presentation ID")

        pres = self._service.presentations().get(presentationId=presentation_id).execute()
        existing_slides = pres.get("slides") or []
        existing_slide_id = existing_slides[0].get("objectId") if existing_slides else None

        all_requests: List[Dict] = []
        total = len(slides)

        for i, slide in enumerate(slides):
            slide_id = _oid("slide", i)
            layout = slide.get("layout") or _slide_layout(i, total)
            image_url = _get_image_url(slide.get("image_query", ""), self._pexels_key)
            self._build_slide(all_requests, slide_id, i, slide, theme, layout, title, image_url)

        if existing_slide_id:
            all_requests.append({"deleteObject": {"objectId": existing_slide_id}})

        batch_size = 40
        for start in range(0, len(all_requests), batch_size):
            batch = all_requests[start : start + batch_size]
            self._service.presentations().batchUpdate(
                presentationId=presentation_id,
                body={"requests": batch},
            ).execute()

        return presentation

    def _build_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        slide: Dict,
        theme: Dict,
        layout: str,
        pres_title: str,
        image_url: Optional[str],
    ) -> None:
        title_text = slide.get("title") or f"Slide {idx + 1}"
        bullets = slide.get("bullets") or []
        accent_text = slide.get("accent_text") or ""

        reqs.append({
            "createSlide": {
                "objectId": slide_id,
                "insertionIndex": idx,
                "slideLayoutReference": {"predefinedLayout": "BLANK"},
            }
        })
        reqs.append({
            "updatePageProperties": {
                "objectId": slide_id,
                "pageProperties": {
                    "pageBackgroundFill": {
                        "solidFill": {"color": {"rgbColor": _rgb(*theme["bg"])}}
                    }
                },
                "fields": "pageBackgroundFill",
            }
        })

        if layout == "title":
            self._title_slide(reqs, slide_id, idx, title_text, bullets, theme, pres_title, image_url)
        elif layout == "quote":
            self._quote_slide(
                reqs, slide_id, idx, title_text,
                accent_text or (bullets[0] if bullets else ""),
                theme, image_url,
            )
        elif layout == "statistic":
            self._statistic_slide(reqs, slide_id, idx, title_text, accent_text, bullets, theme, image_url)
        elif layout == "section":
            self._section_slide(reqs, slide_id, idx, title_text, bullets, theme, image_url)
        elif layout == "closing":
            self._closing_slide(reqs, slide_id, idx, title_text, bullets, theme, pres_title, image_url)
        else:
            self._content_slide(reqs, slide_id, idx, title_text, bullets, theme, image_url)

    def _add_rect(
        self,
        reqs: List[Dict],
        oid: str,
        page_id: str,
        x: float, y: float, w: float, h: float,
        color: tuple,
        alpha: float = 1.0,
    ) -> None:
        reqs.append({
            "createShape": {
                "objectId": oid,
                "shapeType": "RECTANGLE",
                "elementProperties": {
                    "pageObjectId": page_id,
                    "size": {"width": {"magnitude": _emu(w), "unit": "EMU"}, "height": {"magnitude": _emu(h), "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": _emu(x), "translateY": _emu(y), "unit": "EMU"},
                },
            }
        })
        reqs.append({
            "updateShapeProperties": {
                "objectId": oid,
                "shapeProperties": {
                    "shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": _rgb(*color)}, "alpha": alpha}},
                    "outline": {"propertyState": "NOT_RENDERED"},
                },
                "fields": "shapeBackgroundFill,outline",
            }
        })

    def _add_ellipse(
        self,
        reqs: List[Dict],
        oid: str,
        page_id: str,
        x: float, y: float, w: float, h: float,
        color: tuple,
    ) -> None:
        reqs.append({
            "createShape": {
                "objectId": oid,
                "shapeType": "ELLIPSE",
                "elementProperties": {
                    "pageObjectId": page_id,
                    "size": {"width": {"magnitude": _emu(w), "unit": "EMU"}, "height": {"magnitude": _emu(h), "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": _emu(x), "translateY": _emu(y), "unit": "EMU"},
                },
            }
        })
        reqs.append({
            "updateShapeProperties": {
                "objectId": oid,
                "shapeProperties": {
                    "shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": _rgb(*color)}}},
                    "outline": {"propertyState": "NOT_RENDERED"},
                },
                "fields": "shapeBackgroundFill,outline",
            }
        })

    def _add_image(
        self,
        reqs: List[Dict],
        oid: str,
        page_id: str,
        x: float, y: float, w: float, h: float,
        url: str,
    ) -> None:
        if not url:
            return
        reqs.append({
            "createImage": {
                "objectId": oid,
                "url": url,
                "elementProperties": {
                    "pageObjectId": page_id,
                    "size": {"width": {"magnitude": _emu(w), "unit": "EMU"}, "height": {"magnitude": _emu(h), "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": _emu(x), "translateY": _emu(y), "unit": "EMU"},
                },
            }
        })

    def _add_textbox(
        self,
        reqs: List[Dict],
        oid: str,
        page_id: str,
        x: float, y: float, w: float, h: float,
        text: str,
        font_size: float,
        bold: bool,
        italic: bool,
        color: tuple,
        font: str = "Montserrat",
        align: str = "START",
        line_spacing: Optional[int] = None,
    ) -> None:
        reqs.append({
            "createShape": {
                "objectId": oid,
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": page_id,
                    "size": {"width": {"magnitude": _emu(w), "unit": "EMU"}, "height": {"magnitude": _emu(h), "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": _emu(x), "translateY": _emu(y), "unit": "EMU"},
                },
            }
        })
        reqs.append({"insertText": {"objectId": oid, "text": text, "insertionIndex": 0}})
        reqs.append({
            "updateTextStyle": {
                "objectId": oid,
                "textRange": {"type": "ALL"},
                "style": {
                    "foregroundColor": {"opaqueColor": {"rgbColor": _rgb(*color)}},
                    "fontSize": {"magnitude": font_size, "unit": "PT"},
                    "bold": bold,
                    "italic": italic,
                    "fontFamily": font,
                },
                "fields": "foregroundColor,fontSize,bold,italic,fontFamily",
            }
        })
        para = {"alignment": align}
        fields = "alignment"
        if line_spacing:
            para["lineSpacing"] = line_spacing
            fields += ",lineSpacing"
        reqs.append({
            "updateParagraphStyle": {
                "objectId": oid,
                "textRange": {"type": "ALL"},
                "style": para,
                "fields": fields,
            }
        })

    def _title_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        title_text: str,
        bullets: List[str],
        theme: Dict,
        pres_title: str,
        image_url: Optional[str],
    ) -> None:
        if image_url:
            self._add_image(reqs, _oid("timg", idx), slide_id, 0, 0, 10, 7, image_url)
        self._add_rect(reqs, _oid("tovl", idx), slide_id, 0, 0, 10, 7, theme["bg"], alpha=0.75)
        self._add_rect(reqs, _oid("tbar", idx), slide_id, 0, 5.5, 10, 0.08, theme["accent"])
        self._add_rect(reqs, _oid("tacc", idx), slide_id, 0.6, 2.2, 0.08, 2.0, theme["accent"])
        self._add_textbox(reqs, _oid("ttit", idx), slide_id, 0.9, 2.0, 8.0, 2.2, pres_title, 48, True, False, theme["title"], font=theme["title_font"], align="START")
        subtitle = bullets[0] if bullets else title_text
        self._add_textbox(reqs, _oid("tsub", idx), slide_id, 0.9, 4.4, 8.0, 0.8, subtitle, 20, False, True, theme["accent"], font=theme["body_font"], align="START")

    def _content_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        title_text: str,
        bullets: List[str],
        theme: Dict,
        image_url: Optional[str],
    ) -> None:
        if image_url:
            self._add_image(reqs, _oid("cimg", idx), slide_id, 6.0, 1.2, 3.8, 5.5, image_url)
            self._add_rect(reqs, _oid("covl", idx), slide_id, 6.0, 1.2, 3.8, 5.5, theme["bg"], alpha=0.3)
        self._add_rect(reqs, _oid("ctop", idx), slide_id, 0, 0, 10, 1.2, theme["shape"])
        self._add_rect(reqs, _oid("cacc", idx), slide_id, 0, 0, 0.08, 1.2, theme["accent"])
        self._add_rect(reqs, _oid("cbot", idx), slide_id, 0, 6.9, 10, 0.1, theme["accent"])
        self._add_rect(reqs, _oid("cdiv", idx), slide_id, 0.5, 1.35, 5.3, 0.04, theme["accent2"])
        self._add_ellipse(reqs, _oid("cnum", idx), slide_id, 8.7, 6.55, 0.4, 0.4, theme["accent"])
        reqs.append({"insertText": {"objectId": _oid("cnum", idx), "text": str(idx + 1), "insertionIndex": 0}})
        reqs.append({
            "updateTextStyle": {
                "objectId": _oid("cnum", idx),
                "textRange": {"type": "ALL"},
                "style": {
                    "foregroundColor": {"opaqueColor": {"rgbColor": _rgb(*theme["bg"])}},
                    "fontSize": {"magnitude": 12, "unit": "PT"},
                    "bold": True,
                    "fontFamily": "Montserrat",
                },
                "fields": "foregroundColor,fontSize,bold,fontFamily",
            }
        })
        reqs.append({
            "updateParagraphStyle": {"objectId": _oid("cnum", idx), "textRange": {"type": "ALL"}, "style": {"alignment": "CENTER"}, "fields": "alignment"}
        })
        self._add_textbox(reqs, _oid("ctit", idx), slide_id, 0.5, 0.15, 8.5, 0.9, title_text, 30, True, False, theme["title"], font=theme["title_font"])
        body_text = "\n".join(f"  >  {b}" for b in bullets) if bullets else ""
        if body_text:
            self._add_textbox(reqs, _oid("cbod", idx), slide_id, 0.5, 1.5, 5.3, 5.2, body_text, 16, False, False, theme["body"], font=theme["body_font"], line_spacing=150)

    def _quote_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        title_text: str,
        quote_text: str,
        theme: Dict,
        image_url: Optional[str],
    ) -> None:
        if image_url:
            self._add_image(reqs, _oid("qimg", idx), slide_id, 0, 0, 10, 7, image_url)
        self._add_rect(reqs, _oid("qovl", idx), slide_id, 0, 0, 10, 7, theme["bg"], alpha=0.85)
        self._add_rect(reqs, _oid("qlft", idx), slide_id, 0.5, 1.5, 0.12, 4.0, theme["accent"])
        self._add_rect(reqs, _oid("qrgt", idx), slide_id, 9.38, 1.5, 0.12, 4.0, theme["accent"])
        self._add_textbox(reqs, _oid("qquo", idx), slide_id, 1.0, 1.8, 8.0, 3.0, f'"{quote_text}"', 26, False, True, theme["title"], font=theme["title_font"], align="CENTER", line_spacing=160)
        self._add_textbox(reqs, _oid("qsrc", idx), slide_id, 1.0, 5.0, 8.0, 0.6, f"- {title_text}", 18, False, False, theme["accent"], font=theme["body_font"], align="CENTER")

    def _statistic_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        title_text: str,
        stat_text: str,
        bullets: List[str],
        theme: Dict,
        image_url: Optional[str],
    ) -> None:
        if image_url:
            self._add_image(reqs, _oid("stim", idx), slide_id, 0, 0, 10, 7, image_url)
        self._add_rect(reqs, _oid("stov", idx), slide_id, 0, 0, 10, 7, theme["bg"], alpha=0.88)
        self._add_rect(reqs, _oid("stbt", idx), slide_id, 0, 6.9, 10, 0.1, theme["accent"])
        self._add_ellipse(reqs, _oid("stci", idx), slide_id, 3.2, 0.8, 3.6, 3.6, theme["shape"])
        if stat_text:
            self._add_textbox(reqs, _oid("stnu", idx), slide_id, 3.2, 1.0, 3.6, 2.5, stat_text, 52, True, False, theme["accent"], font=theme["title_font"], align="CENTER")
        self._add_textbox(reqs, _oid("stti", idx), slide_id, 0.5, 4.6, 9.0, 0.8, title_text, 28, True, False, theme["title"], font=theme["title_font"], align="CENTER")
        body_text = "\n".join(f"  >  {b}" for b in bullets[:2]) if bullets else ""
        if body_text:
            self._add_textbox(reqs, _oid("stbo", idx), slide_id, 0.5, 5.5, 9.0, 1.2, body_text, 15, False, False, theme["body"], font=theme["body_font"], align="CENTER")

    def _section_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        title_text: str,
        bullets: List[str],
        theme: Dict,
        image_url: Optional[str],
    ) -> None:
        if image_url:
            self._add_image(reqs, _oid("seig", idx), slide_id, 5.5, 0, 4.5, 7, image_url)
            self._add_rect(reqs, _oid("seov", idx), slide_id, 5.5, 0, 4.5, 7, theme["bg"], alpha=0.5)
        self._add_rect(reqs, _oid("sebg", idx), slide_id, 0, 0, 5.8, 7, theme["shape"])
        self._add_rect(reqs, _oid("seac", idx), slide_id, 0, 0, 0.15, 7, theme["accent"])
        self._add_rect(reqs, _oid("sebt", idx), slide_id, 0, 6.9, 10, 0.1, theme["accent2"])
        self._add_textbox(reqs, _oid("seti", idx), slide_id, 0.4, 2.5, 5.0, 2.0, title_text, 38, True, False, theme["title"], font=theme["title_font"])
        if bullets:
            self._add_textbox(reqs, _oid("sesu", idx), slide_id, 0.4, 4.7, 5.0, 0.8, bullets[0], 17, False, True, theme["accent"], font=theme["body_font"])

    def _closing_slide(
        self,
        reqs: List[Dict],
        slide_id: str,
        idx: int,
        title_text: str,
        bullets: List[str],
        theme: Dict,
        pres_title: str,
        image_url: Optional[str],
    ) -> None:
        if image_url:
            self._add_image(reqs, _oid("clim", idx), slide_id, 0, 0, 10, 7, image_url)
        self._add_rect(reqs, _oid("clov", idx), slide_id, 0, 0, 10, 7, theme["bg"], alpha=0.82)
        self._add_rect(reqs, _oid("cltp", idx), slide_id, 0, 0, 10, 0.12, theme["accent"])
        self._add_rect(reqs, _oid("clbt", idx), slide_id, 0, 6.88, 10, 0.12, theme["accent"])
        self._add_ellipse(reqs, _oid("clci", idx), slide_id, 3.75, 0.8, 2.5, 2.5, theme["shape"])
        self._add_textbox(reqs, _oid("clti", idx), slide_id, 0.5, 3.5, 9.0, 1.5, title_text, 44, True, False, theme["accent"], font=theme["title_font"], align="CENTER")
        subtitle = bullets[0] if bullets else pres_title
        self._add_textbox(reqs, _oid("clsu", idx), slide_id, 0.5, 5.1, 9.0, 0.8, subtitle, 18, False, True, theme["body"], font=theme["body_font"], align="CENTER")
