import io
import csv
import pdfplumber

def normalize_text(raw: str) -> str:
    t = raw.replace("\r\n", "\n").replace("\r", "\n")

    clean_lines = []
    for line in t.split("\n"):
        clean_line = line.strip()
        clean_lines.append(clean_line)

    t = "\n".join(clean_lines)

    while "\n\n\n" in t:
        t = t.replace("\n\n\n", "\n\n")

    return t.strip()


def analyze_pdf_bytes(pdf_bytes: bytes, filename: str) -> dict:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text_parts = []
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)

    text = "\n".join(text_parts)

    norm = normalize_text(text)
    lines = norm.split("\n")
    norm_lower = norm.lower()

    meta = {}
    for line in lines:
        if line.startswith("Job Posting:"):
            after_label = line[len("Job Posting: "):]
            posting_id = after_label.split()[0] if after_label else ""
            meta["posting_id"] = posting_id

        elif line.startswith("Organization "):
            meta["organization"] = line[len("Organization "):].strip()

        elif line.startswith("Job Title "):
            meta["job_title"] = line[len("Job Title "):].strip()

        elif line.startswith("Work Term Duration "):
            meta["term_duration"] = line[len("Work Term Duration "):].strip()

    skills = {
        "python": ["python"],
        "excel": ["excel"],
        "sql": ["sql"],
        "power_bi": ["power bi", "powerbi"],
        "tableau": ["tableau"],
        "git": ["git", "github"],
        "communication": ["communication", "written", "verbal"],
        "stakeholder": ["stakeholder", "stakeholders", "cross-functional"],
        "documentation": ["documentation", "documenting"],
        "project_management": ["project management", "project coordination"],
    }

    found_skills = []
    for skill_name, keywords in skills.items():
        for kw in keywords:
            if kw in norm_lower:
                found_skills.append(skill_name)
                break

    warnings = []
    if not norm:
        warnings.append("empty text")
    if not meta.get("posting_id"):
        warnings.append("missing posting_id")
    if not meta.get("organization"):
        warnings.append("missing organization")
    if not meta.get("job_title"):
        warnings.append("missing job_title")

    return {
        "filename": filename,
        "posting_id": meta.get("posting_id", ""),
        "organization": meta.get("organization", ""),
        "job_title": meta.get("job_title", ""),
        "term_duration": meta.get("term_duration", ""),
        "skills": ", ".join(found_skills),
        "raw_text_length": str(len(norm)),
        "parse_warnings": "; ".join(warnings),
        "job_text": norm,
    }


def analyze_batch_to_csv_bytes(pdf_bytes_list: list[bytes], filenames: list[str]) -> bytes:
    rows = []
    for pdf_bytes, name in zip(pdf_bytes_list, filenames):
        rows.append(analyze_pdf_bytes(pdf_bytes, name))

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "filename",
            "posting_id",
            "organization",
            "job_title",
            "term_duration",
            "skills",
            "raw_text_length",
            "parse_warnings",
        ],
        extrasaction="ignore", 
    )
    writer.writeheader()
    writer.writerows(rows)

    return output.getvalue().encode("utf-8")
