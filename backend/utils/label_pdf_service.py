"""
Label PDF Generation Service

Generates QR-code-only labels using ReportLab for precise, single-page output.
Each label is drawn as a compact box on a standard letter page (8.5" x 11")
with a dashed cut border, so users can print on any paper and cut to size.

Layout (landscape box, QR code left / info fields right):

  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  ← dashed cut line
  │ SupplyLine MRO           PART-001 - LOT-XYZ        │  ← header strip
  │  ┌──────┐  │  TOOL NUMBER    DESCRIPTION           │
  │  │  QR  │  │  TL-001        Torque Wrench          │
  │  │      │  │  LOCATION      STATUS                 │
  │  └──────┘  │  Bay 3         Available              │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
"""

import io
from typing import Any, Literal

import segno
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas

# ── Label size configurations ─────────────────────────────────────────────────
# Physical label box dimensions drawn on the letter page.
# All measurements are in inches; ReportLab converts to points internally.
_LABEL_CFG: dict[str, dict] = {
    "4x6": {
        "w": 5.0, "h": 3.2,        # box size on the page
        "qr_frac": 0.52,            # QR width as fraction of body height
        "header_h": 0.28,           # header strip height (inches)
        "pad": 0.10,                # inner padding (inches)
        "title_font": 8.5,          # header font sizes (points)
        "label_font": 6.0,          # field-label font (grey)
        "value_font": 7.5,          # field-value font (dark)
        "line_gap": 3,              # extra gap between label/value rows
        "max_fields": 8,
    },
    "3x4": {
        "w": 4.0, "h": 2.6,
        "qr_frac": 0.52,
        "header_h": 0.25,
        "pad": 0.08,
        "title_font": 7.5,
        "label_font": 5.5,
        "value_font": 7.0,
        "line_gap": 2,
        "max_fields": 6,
    },
    "2x4": {
        "w": 3.2, "h": 2.0,
        "qr_frac": 0.50,
        "header_h": 0.22,
        "pad": 0.07,
        "title_font": 7.0,
        "label_font": 5.0,
        "value_font": 6.5,
        "line_gap": 2,
        "max_fields": 4,
    },
    "2x2": {
        "w": 2.6, "h": 1.6,
        "qr_frac": 0.50,
        "header_h": 0.20,
        "pad": 0.06,
        "title_font": 6.5,
        "label_font": 4.5,
        "value_font": 6.0,
        "line_gap": 1,
        "max_fields": 3,
    },
}

# Kept for API compatibility — backend always generates QR codes
CodeType = Literal["barcode", "qrcode"]
ItemType = Literal["tool", "chemical", "expendable", "kit_item"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _qr_reader(data: str) -> ImageReader:
    """Render QR code to PNG and wrap in ReportLab ImageReader."""
    qr = segno.make(data, error="m", boost_error=False)
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=12, border=2, dark="#000000", light="#FFFFFF")
    buf.seek(0)
    return ImageReader(buf)


def _fit(text: str, c: rl_canvas.Canvas, font: str, size: float, max_w: float) -> str:
    """Truncate *text* with an ellipsis to fit within *max_w* points."""
    if c.stringWidth(text, font, size) <= max_w:
        return text
    while len(text) > 1 and c.stringWidth(text + "\u2026", font, size) > max_w:
        text = text[:-1]
    return text + "\u2026"


# ── Core drawing routine ──────────────────────────────────────────────────────

def _draw_label(
    c: rl_canvas.Canvas,
    lx: float,
    ly: float,
    cfg: dict,
    item_title: str,
    qr_data: str,
    fields: list[dict[str, str]],
    warning_text: str | None = None,
) -> None:
    """
    Draw one label box at canvas coordinates (lx, ly) — bottom-left in
    ReportLab's coordinate system (y increases upward).
    """
    LW = cfg["w"] * inch
    LH = cfg["h"] * inch
    HDR = cfg["header_h"] * inch
    PAD = cfg["pad"] * inch

    # ── Dashed cut border ─────────────────────────────────────────────────────
    c.saveState()
    c.setDash(5, 4)
    c.setStrokeColor(colors.HexColor("#aaaaaa"))
    c.setLineWidth(0.6)
    c.rect(lx, ly, LW, LH, stroke=1, fill=0)
    c.restoreState()

    # ── Header strip ──────────────────────────────────────────────────────────
    hdr_y = ly + LH - HDR
    c.setFillColor(colors.HexColor("#2c3e50"))
    c.rect(lx, hdr_y, LW, HDR, stroke=0, fill=1)

    text_baseline = hdr_y + HDR * 0.25
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", cfg["title_font"])
    c.drawString(lx + PAD, text_baseline, "SupplyLine MRO")

    c.setFont("Helvetica", cfg["title_font"] - 1)
    title_max = LW - c.stringWidth("SupplyLine MRO", "Helvetica-Bold", cfg["title_font"]) - PAD * 3
    title = _fit(item_title, c, "Helvetica", cfg["title_font"] - 1, title_max)
    c.drawRightString(lx + LW - PAD, text_baseline, title)

    # ── Warning banner (optional — used for transfer labels) ─────────────────
    warn_h = 0.0
    if warning_text:
        warn_h = cfg["title_font"] * 1.6
        warn_y = hdr_y - warn_h
        c.setFillColor(colors.HexColor("#e74c3c"))
        c.rect(lx, warn_y, LW, warn_h, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", cfg["title_font"] - 1)
        c.drawCentredString(lx + LW / 2, warn_y + warn_h * 0.20, warning_text)

    # ── Body area ─────────────────────────────────────────────────────────────
    body_top = hdr_y - warn_h
    body_h = body_top - ly
    body_x = lx + PAD
    body_w = LW - 2 * PAD

    # QR code — square, sized as fraction of body height, vertically centred
    QR = body_h * cfg["qr_frac"]
    qr_x = body_x
    qr_y = ly + (body_h - QR) / 2
    c.drawImage(_qr_reader(qr_data), qr_x, qr_y, QR, QR, preserveAspectRatio=True)

    # Thin vertical divider
    div_x = body_x + QR + PAD * 0.6
    c.saveState()
    c.setStrokeColor(colors.HexColor("#dde0e3"))
    c.setLineWidth(0.6)
    c.line(div_x, ly + PAD * 0.5, div_x, body_top - PAD * 0.5)
    c.restoreState()

    # ── Fields (right column) ─────────────────────────────────────────────────
    fx = div_x + PAD * 0.8
    fw = lx + LW - PAD - fx          # available width for text

    LF = cfg["label_font"]           # label-row font size (points)
    VF = cfg["value_font"]           # value-row font size (points)
    GAP = cfg["line_gap"]            # gap between field blocks

    ROW_H = LF + VF + GAP + 2       # height of one label+value block

    shown = fields[: cfg["max_fields"]]
    total_h = len(shown) * ROW_H - GAP
    # Start y so fields are vertically centred in the body area
    fy = ly + (body_h + total_h) / 2 - LF

    for field in shown:
        if fy - VF < ly + 2:
            break

        # Field label (small, grey)
        c.setFillColor(colors.HexColor("#95a5a6"))
        c.setFont("Helvetica", LF)
        lbl = _fit(field["label"].upper(), c, "Helvetica", LF, fw)
        c.drawString(fx, fy, lbl)
        fy -= LF + 1

        # Field value (larger, dark)
        c.setFillColor(colors.HexColor("#1a2632"))
        c.setFont("Helvetica-Bold", VF)
        val = _fit(str(field["value"]), c, "Helvetica-Bold", VF, fw)
        c.drawString(fx, fy, val)
        fy -= VF + GAP + 2


# ── Public PDF builder ────────────────────────────────────────────────────────

def _build_label_pdf(
    item_title: str,
    qr_data: str,
    fields: list[dict[str, str]],
    label_size: str,
    warning_text: str | None = None,
) -> bytes:
    """
    Produce a letter-size (8.5" x 11") PDF with the label drawn at the
    top-left corner.  The dashed border shows where to cut.
    """
    cfg = _LABEL_CFG.get(label_size, _LABEL_CFG["3x4"])
    PAGE_W, PAGE_H = letter          # 612 × 792 pt
    MARGIN = 0.45 * inch

    lx = MARGIN
    ly = PAGE_H - MARGIN - cfg["h"] * inch

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=letter)
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
) -> bytes:
    tool_number = tool.tool_number or ""
    if tool.lot_number:
        qr_data = f"{tool_number}-LOT-{tool.lot_number}"
    else:
        qr_data = f"{tool_number}-{tool.serial_number or ''}"

    title = tool.tool_number or "Tool"
    if tool.lot_number:
        title += f" - LOT {tool.lot_number}"
    elif tool.serial_number:
        title += f" - SN {tool.serial_number}"

    fields: list[dict[str, str]] = [
        {"label": "Tool Number", "value": tool.tool_number or "N/A"},
        {"label": "Description", "value": tool.description or "N/A"},
        {"label": "Location",    "value": tool.location or "N/A"},
        {"label": "Status",      "value": tool.status or "N/A"},
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
) -> bytes:
    part_number = chemical.part_number or ""
    lot_number  = chemical.lot_number or ""
    exp_date    = chemical.expiration_date.strftime("%Y%m%d") if chemical.expiration_date else "NOEXP"
    qr_data     = f"{part_number}-{lot_number}-{exp_date}"
    title       = f"{chemical.part_number} - {chemical.lot_number}"

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
            fields.append({"label": "Transfer Date", "value": td.strftime("%Y-%m-%d") if hasattr(td, "strftime") else str(td)})
        warning_text = "PARTIAL TRANSFER \u2013 NEW LOT NUMBER"

    return _build_label_pdf(title, qr_data, fields, label_size, warning_text)


def generate_expendable_label_pdf(
    expendable: Any,
    label_size: str = "3x4",
    code_type: CodeType = "qrcode",
) -> bytes:
    part_number = expendable.part_number or ""
    if expendable.lot_number:
        qr_data = f"{part_number}-LOT-{expendable.lot_number}"
    else:
        qr_data = f"{part_number}-SN-{expendable.serial_number or ''}"

    title = expendable.part_number or "Expendable"
    if expendable.lot_number:
        title += f" - LOT {expendable.lot_number}"
    elif expendable.serial_number:
        title += f" - SN {expendable.serial_number}"

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
