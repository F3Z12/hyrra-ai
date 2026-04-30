"""
PDF text extraction.

Responsibility: convert PDF bytes into raw text. That's it.
The extracted text is then normalized and analyzed by downstream modules.
"""

import io
import pdfplumber


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    Extract raw text from PDF bytes using pdfplumber.

    Returns the concatenated text from all pages (unnormalized).
    Downstream code should call normalize_text() on the result.
    """
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text_parts = []
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)

    return "\n".join(text_parts)
