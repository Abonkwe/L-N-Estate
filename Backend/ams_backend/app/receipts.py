"""Receipt PDF laid out like the paper receipt book (bilingual EN/FR)."""
from datetime import date
from io import BytesIO

from num2words import num2words
from reportlab.lib.pagesizes import A5, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas


def amount_in_words(amount: int) -> str:
    return num2words(amount, lang="en").replace(",", "").capitalize() + " francs CFA"


def render_receipt_pdf(*, number: int, received_from: str, amount: int, purpose: str,
                       balance: int, place: str, on: date, business_name: str,
                       is_void: bool = False) -> bytes:
    buf = BytesIO()
    width, height = landscape(A5)
    c = canvas.Canvas(buf, pagesize=(width, height))
    left, right = 15 * mm, width - 15 * mm
    c.setLineWidth(1)
    c.rect(8 * mm, 8 * mm, width - 16 * mm, height - 16 * mm)

    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 20 * mm, business_name)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(width / 2, height - 28 * mm, "REÇU / RECEIPT")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(right, height - 20 * mm, f"N° {number:05d}")

    y = height - 42 * mm

    def row(label: str, value: str, size: int = 11, lines: int = 1):
        nonlocal y
        c.setFont("Helvetica", 8)
        c.setFillGray(0.4)
        c.drawString(left, y, label)
        c.setFillGray(0)
        c.setFont("Helvetica-Bold", size)
        for line in simpleSplit(value, "Helvetica-Bold", size, right - left - 42 * mm)[:lines]:
            c.drawString(left + 42 * mm, y, line)
            y -= 5 * mm
        c.setLineWidth(0.3)
        c.line(left + 42 * mm, y + 3.5 * mm, right, y + 3.5 * mm)
        y -= 3 * mm

    row("Reçu de M. / Received from", received_from)
    row("La somme / The sum of", f"{amount_in_words(amount)} ({amount:,} FCFA)".replace(",", " "), lines=2)
    row("Motif / Purpose", purpose, lines=2)
    row("Avance / Amount paid", f"{amount:,} FCFA".replace(",", " "))
    row("Reste / Balance", f"{balance:,} FCFA".replace(",", " ") if balance else "-")
    row("À / At", place)
    row("Le / Date", on.strftime("%d/%m/%Y"))

    c.setFont("Helvetica", 9)
    c.drawRightString(right, 20 * mm, "Signature")
    c.line(right - 45 * mm, 24 * mm, right, 24 * mm)

    if is_void:
        c.saveState()
        c.setFont("Helvetica-Bold", 90)
        c.setFillGray(0.85)
        c.translate(width / 2, height / 2)
        c.rotate(25)
        c.drawCentredString(0, 0, "VOID")
        c.restoreState()

    c.showPage()
    c.save()
    return buf.getvalue()
