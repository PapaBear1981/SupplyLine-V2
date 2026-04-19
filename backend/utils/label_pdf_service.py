"""
Label PDF Generation Service

Generates QR-code-only labels using ReportLab.  The PDF page is always a
standard 4"×6" sticker — the selected label size determines how much of that
sticker is used:

  4×6  → fills the entire sticker (no cut needed), shows the most info
  3×4  → top-left 3"×4" region with a dashed cut border
  2×4  → top-left 2"×4" region with a dashed cut border
  2×2  → top-left 2"×2" region with a dashed cut border

All layouts use a portrait orientation:
  • dark header strip (company name left, item title right)
  • QR code centred horizontally below the header
  • info fields below the QR code (2 columns for larger sizes, 1 for smaller)

Users print on their 4"×6" label stock and cut along the dashed border for
the smaller label sizes.
"""

import io
from typing import Any, Literal

import segno
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas


# ── Page ──────────────────────────────────────────────────────────────────────
# Always a 4"×6" sticker regardless of which label size is selected.
PAGE_W = 4 * inch   # 288 pt
PAGE_H = 6 * inch   # 432 pt

# ── Label size configurations ─────────────────────────────────────────────────
_CFG: dict[str, dict] = {
    "4x6": {
        "w": 4.0, "h": 6.0,        # label box fills the whole sticker
        "cut_border": False,         # no cut needed — it IS the sticker
        "header_h": 0.42,
        "pad": 0.14,
        "qr_frac": 0.62,            # QR size as fraction of body width
        "company_font": 10.0,
        "title_font":   9.5,
        "label_font":   6.5,        # field-name row (grey, uppercase)
        "value_font":   8.0,        # field-value row (dark, bold)
        "line_gap":     4,          # extra pt between value and next label
        "field_cols":   2,
        "max_fields":  10,
    },
    "3x4": {
        "w": 3.0, "h": 4.0,
        "cut_border": True,
        "header_h": 0.34,
        "pad": 0.11,
        "qr_frac": 0.60,
        "company_font": 8.5,
        "title_font":   8.0,
        "label_font":   5.5,
        "value_font":   7.0,
        "line_gap":     3,
        "field_cols":   2,
        "max_fields":   6,
    },
    "2x4": {
        "w": 2.0, "h": 4.0,
        "cut_border": True,
        "header_h": 0.28,
        "pad": 0.09,
        "qr_frac": 0.68,
        "company_font": 7.0,
        "title_font":   6.5,
        "label_font":   5.0,
        "value_font":   6.5,
        "line_gap":     2,
        "field_cols":   1,
        "max_fields":   4,
    },
    "2x2": {
        "w": 2.0, "h": 2.0,
        "cut_border": True,
        "header_h": 0.24,
        "pad": 0.08,
        "qr_frac": 0.55,
        "company_font": 6.5,
        "title_font":   6.0,
        "label_font":   4.5,
        "value_font":   5.8,
        "line_gap":     1,
        "field_cols":   1,
        "max_fields":   3,
    },
}

# Kept for API compatibility — backend always generates QR codes
CodeType = Literal["barcode", "qrcode"]
ItemType = Literal["tool", "chemical", "expendable", "kit_item"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _qr_reader(data: str) -> ImageReader:
    """Render QR code to PNG and wrap in a ReportLab ImageReader.

    border=4 satisfies the QR spec's minimum 4-module quiet zone requirement.
    scale=12 gives a 336-px source image for version-1 codes — plenty of
    resolution even after ReportLab scales it to fit the drawn box.
    """
    qr = segno.make(data, error="m", boost_error=False)
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=12, border=4, dark="#000000", light="#FFFFFF")
    buf.seek(0)
    return ImageReader(buf)


def _fit(text: str, c: rl_canvas.Canvas, font: str, size: float, max_w: float) -> str:
    """Truncate *text* with an ellipsis so it fits within *max_w* points."""
    if c.stringWidth(text, font, size) <= max_w:
        return text
    while len(text) > 1 and c.stringWidth(text + "\u2026", font, size) > max_w:
        text = text[:-1]
    return text + "\u2026"


def _draw_field(
    c: rl_canvas.Canvas,
    fx: float,
    fy: float,     # baseline of the label row
    fw: float,
    field: dict[str, str],
    lf: float,
    vf: float,
) -> None:
    """Draw one field: a small grey label row then a bold dark value row."""
    c.setFillColor(colors.HexColor("#7f8c8d"))
    c.setFont("Helvetica", lf)
    c.drawString(fx, fy, _fit(field["label"].upper(), c, "Helvetica", lf, fw))

    c.setFillColor(colors.HexColor("#1a2632"))
    c.setFont("Helvetica-Bold", vf)
    c.drawString(fx, fy - lf - 1, _fit(str(field["value"]), c, "Helvetica-Bold", vf, fw))


# ── Core drawing routine ──────────────────────────────────────────────────────

def _draw_label(
    c: rl_canvas.Canvas,
    lx: float,
    ly: float,          # bottom-left of the label box (ReportLab y=0 is bottom)
    cfg: dict,
    item_title: str,
    qr_data: str,
    fields: list[dict[str, str]],
    warning_text: str | None = None,
) -> None:
    LW  = cfg["w"] * inch
    LH  = cfg["h"] * inch
    HDR = cfg["header_h"] * inch
    PAD = cfg["pad"] * inch

    # ── Border ────────────────────────────────────────────────────────────────
    if cfg["cut_border"]:
        # Dashed cut line for sub-sticker sizes
        c.saveState()
        c.setDash(5, 4)
        c.setStrokeColor(colors.HexColor("#aaaaaa"))
        c.setLineWidth(0.7)
        c.rect(lx, ly, LW, LH, stroke=1, fill=0)
        c.restoreState()
    else:
        # Solid border for the full-sticker (4×6) label
        c.saveState()
        c.setStrokeColor(colors.HexColor("#2c3e50"))
        c.setLineWidth(1.5)
        c.rect(lx, ly, LW, LH, stroke=1, fill=0)
        c.restoreState()

    # ── Header strip ──────────────────────────────────────────────────────────
    hdr_y = ly + LH - HDR
    c.setFillColor(colors.HexColor("#2c3e50"))
    c.rect(lx, hdr_y, LW, HDR, stroke=0, fill=1)

    # Accent bar (blue underline on header)
    c.setFillColor(colors.HexColor("#2980b9"))
    c.rect(lx, hdr_y, LW, 2, stroke=0, fill=1)

    text_y = hdr_y + HDR * 0.24
    c.setFillColor(colors.white)

    # Company name — left
    c.setFont("Helvetica-Bold", cfg["company_font"])
    c.drawString(lx + PAD, text_y, "SupplyLine MRO")

    # Item title — right (truncated to fit)
    c.setFont("Helvetica", cfg["title_font"] - 1)
    co_w      = c.stringWidth("SupplyLine MRO", "Helvetica-Bold", cfg["company_font"])
    title_max = LW - co_w - PAD * 3
    title     = _fit(item_title, c, "Helvetica", cfg["title_font"] - 1, title_max)
    c.drawRightString(lx + LW - PAD, text_y, title)

    # ── Optional warning banner (transfer labels) ─────────────────────────────
    warn_h = 0.0
    if warning_text:
        warn_h = cfg["company_font"] * 1.9
        warn_y = hdr_y - warn_h
        c.setFillColor(colors.HexColor("#e74c3c"))
        c.rect(lx, warn_y, LW, warn_h, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", cfg["company_font"] - 1.5)
        c.drawCentredString(lx + LW / 2, warn_y + warn_h * 0.22, warning_text)

    # ── Body ──────────────────────────────────────────────────────────────────
    body_top = hdr_y - warn_h
    body_x   = lx + PAD
    body_w   = LW - 2 * PAD
    body_y   = ly + PAD

    # QR code — centred horizontally, with a small gap below the header so the
    # quiet zone is never adjacent to the dark header strip.
    QR      = cfg["qr_frac"] * body_w
    qr_gap  = PAD * 0.5                  # breathing room under the header
    qr_x    = body_x + (body_w - QR) / 2
    qr_y    = body_top - qr_gap - QR    # bottom of QR image

    # Explicit white background guarantees the quiet zone is never compromised
    # by adjacent dark elements when printing.
    c.setFillColor(colors.white)
    c.rect(qr_x, qr_y, QR, QR, stroke=0, fill=1)
    c.drawImage(_qr_reader(qr_data), qr_x, qr_y, QR, QR,
                preserveAspectRatio=True, mask=None)

    # ── Fields (below QR) ─────────────────────────────────────────────────────
    LF     = cfg["label_font"]
    VF     = cfg["value_font"]
    GAP    = cfg["line_gap"]
    ROW_H  = LF + 1 + VF + GAP + 2    # height of one full field block

    fields_top = qr_y - PAD * 0.4     # a small gap under the QR
    shown      = fields[: cfg["max_fields"]]

    if cfg["field_cols"] == 2 and len(shown) > 1:
        # Two-column layout: interleave fields (even → left, odd → right)
        col_w = (body_w - PAD * 0.5) / 2
        left  = shown[0::2]
        right = shown[1::2]
        for col_idx, col_fields in enumerate((left, right)):
            fx = body_x + col_idx * (col_w + PAD * 0.5)
            fy = fields_top - LF
            for field in col_fields:
                if fy - VF < body_y:
                    break
                _draw_field(c, fx, fy, col_w - 2, field, LF, VF)
                fy -= ROW_H
    else:
        # Single-column layout
        fy = fields_top - LF
        for field in shown:
            if fy - VF < body_y:
                break
            _draw_field(c, body_x, fy, body_w, field, LF, VF)
            fy -= ROW_H


# ── PDF builder ───────────────────────────────────────────────────────────────

def _build_label_pdf(
    item_title: str,
    qr_data: str,
    fields: list[dict[str, str]],
    label_size: str,
    warning_text: str | None = None,
) -> bytes:
    """
    Produce a 4"×6" PDF (standard sticker stock) with the label drawn
    starting at the top-left corner.  Smaller label sizes include a dashed
    cut border; the 4×6 size fills the entire sticker.
    """
    cfg = _CFG.get(label_size, _CFG["3x4"])

    # Label box: anchored to the top-left of the 4×6 page
    lx = 0.0
    ly = PAGE_H - cfg["h"] * inch      # bottom of label box

    buf = io.BytesIO()
    c   = rl_canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    c.setTitle(f"Label \u2013 {item_title}")
    _draw_label(c, lx, ly, cfg, item_title, qr_data, fields, warning_text)
    c.showPage()
    c.save()
    return buf.getvalue()


# ── Public API (signatures unchanged so routes need no changes) ───────────────

def generate_label_pdf(
    item_title: str,
    barcode_data: str,
    fields: list[dict[str, str]],
    label_size: str = "3x4",
    code_type: CodeType = "qrcode",   # kept for API compat; always QR
    is_transfer: bool = False,
    warning_text: str | None = None,
    barcode_type: str = "CODE128",    # unused; kept for compat
) -> bytes:
    return _build_label_pdf(item_title, barcode_data, fields, label_size, warning_text)


def generate_tool_label_pdf(
    tool: Any,
    label_size: str = "3x4",
    code_type: CodeType = "qrcode",
    base_url: str = "",
) -> bytes:
    # Full URL so the QR code works with any scanner app, not just the
    # in-app scanner.  parseScannedCode.ts matches the /tool-view/{id}
    # substring whether or not a full origin is present.
    qr_data = f"{base_url}/tool-view/{tool.id}"

    title = tool.tool_number or "Tool"
    if tool.lot_number:
        title += f" \u2013 LOT {tool.lot_number}"
    elif tool.serial_number:
        title += f" \u2013 SN {tool.serial_number}"

    fields: list[dict[str, str]] = [
        {"label": "Tool Number",  "value": tool.tool_number or "N/A"},
        {"label": "Description",  "value": tool.description or "N/A"},
        {"label": "Location",     "value": tool.location or "N/A"},
        {"label": "Status",       "value": tool.status or "N/A"},
    ]
    if tool.lot_number:
        fields.append({"label": "Lot Number",    "value": tool.lot_number})
    if tool.serial_number:
        fields.append({"label": "Serial Number", "value": tool.serial_number})
    if tool.category:
        fields.append({"label": "Category",      "value": tool.category})
    if tool.condition:
        fields.append({"label": "Condition",     "value": tool.condition})
    if hasattr(tool, "created_at") and tool.created_at:
        fields.append({"label": "Date Added",    "value": tool.created_at.strftime("%Y-%m-%d")})

    return _build_label_pdf(title, qr_data, fields, label_size)


def generate_chemical_label_pdf(
    chemical: Any,
    label_size: str = "3x4",
    code_type: CodeType = "qrcode",
    is_transfer: bool = False,
    transfer_data: dict[str, Any] | None = None,
    base_url: str = "",
) -> bytes:
    # Full URL so the QR code works with any scanner app, not just the
    # in-app scanner.  parseScannedCode.ts matches the /chemical-view/{id}
    # substring whether or not a full origin is present.
    qr_data = f"{base_url}/chemical-view/{chemical.id}"
    title   = f"{chemical.part_number} \u2013 {chemical.lot_number}"

    display_qty = chemical.quantity
    if chemical.status == "issued" and chemical.parent_lot_number and chemical.issuance:
        display_qty = chemical.issuance.quantity

    fields: list[dict[str, str]] = [
        {"label": "Part Number",  "value": chemical.part_number or "N/A"},
        {"label": "Lot Number",   "value": chemical.lot_number or "N/A"},
        {"label": "Description",  "value": chemical.description or "N/A"},
        {"label": "Manufacturer", "value": chemical.manufacturer or "N/A"},
        {"label": "Quantity",     "value": f"{display_qty} {chemical.unit or 'each'}" if display_qty is not None else "N/A"},
        {"label": "Location",     "value": chemical.location or "N/A"},
        {"label": "Status",       "value": chemical.status or "N/A"},
    ]
    if chemical.expiration_date:
        fields.append({"label": "Expiration Date", "value": chemical.expiration_date.strftime("%Y-%m-%d")})
    if chemical.date_added:
        fields.append({"label": "Date Added",      "value": chemical.date_added.strftime("%Y-%m-%d")})

    warning_text = None
    if is_transfer and transfer_data:
        if transfer_data.get("parent_lot_number"):
            fields.append({"label": "Parent Lot",  "value": transfer_data["parent_lot_number"]})
        if transfer_data.get("destination"):
            fields.append({"label": "Destination", "value": transfer_data["destination"]})
        if transfer_data.get("transfer_date"):
            td = transfer_data["transfer_date"]
            fields.append({"label": "Transfer Date",
                           "value": td.strftime("%Y-%m-%d") if hasattr(td, "strftime") else str(td)})
        warning_text = "PARTIAL TRANSFER \u2013 NEW LOT NUMBER"

    return _build_label_pdf(title, qr_data, fields, label_size, warning_text)


def generate_expendable_label_pdf(
    expendable: Any,
    label_size: str = "3x4",
    code_type: CodeType = "qrcode",
    kit_id: int | None = None,
    base_url: str = "",
) -> bytes:
    # Full URL so the QR code works with any scanner app.
    # Expendables live inside kits; navigate to the parent kit when kit_id is
    # known, otherwise fall back to a stable identifier string.
    if kit_id is not None:
        qr_data = f"{base_url}/kits/{kit_id}"
    else:
        part_number = expendable.part_number or ""
        if expendable.lot_number:
            qr_data = f"{part_number}-LOT-{expendable.lot_number}"
        else:
            qr_data = f"{part_number}-SN-{expendable.serial_number or part_number}"

    title = expendable.part_number or "Expendable"
    if expendable.lot_number:
        title += f" \u2013 LOT {expendable.lot_number}"
    elif expendable.serial_number:
        title += f" \u2013 SN {expendable.serial_number}"

    fields: list[dict[str, str]] = [
        {"label": "Part Number", "value": expendable.part_number or "N/A"},
        {"label": "Description", "value": expendable.description or "N/A"},
        {"label": "Quantity",    "value": f"{expendable.quantity} {expendable.unit}" if expendable.quantity else "N/A"},
        {"label": "Location",    "value": expendable.location or "N/A"},
        {"label": "Category",    "value": expendable.category or "N/A"},
    ]
    if expendable.lot_number:
        fields.append({"label": "Lot Number",    "value": expendable.lot_number})
    if expendable.serial_number:
        fields.append({"label": "Serial Number", "value": expendable.serial_number})
    if expendable.date_added:
        fields.append({"label": "Date Added",    "value": expendable.date_added.strftime("%Y-%m-%d")})

    return _build_label_pdf(title, qr_data, fields, label_size)
