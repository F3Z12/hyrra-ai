"""
Shared text normalization utilities.

Used by ALL input types: PDF text, pasted text, future Chrome extension, scrapers.
"""


def normalize_text(raw: str) -> str:
    """
    Clean and normalize raw text from any source.

    Steps:
    1. Standardize line endings (CRLF/CR → LF)
    2. Strip leading/trailing whitespace per line
    3. Collapse runs of 3+ newlines down to 2 (one blank line max)
    4. Strip leading/trailing whitespace from entire result
    """
    t = raw.replace("\r\n", "\n").replace("\r", "\n")

    clean_lines = []
    for line in t.split("\n"):
        clean_lines.append(line.strip())

    t = "\n".join(clean_lines)

    while "\n\n\n" in t:
        t = t.replace("\n\n\n", "\n\n")

    return t.strip()
