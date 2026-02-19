from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response
import io
import zipfile

from analyzer import analyze_batch_to_csv_bytes, analyze_pdf_bytes
from llm import generate_cover_letter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/v1/batch/analyze")
async def batch_analyze(files: list[UploadFile] = File(...)):
    pdf_bytes_list: list[bytes] = []
    filenames: list[str] = []

    for f in files:
        filenames.append(f.filename or "unknown.pdf")
        pdf_bytes_list.append(await f.read())

    csv_bytes = analyze_batch_to_csv_bytes(pdf_bytes_list, filenames)

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="analysis.csv"'},
    )

@app.post("/v1/batch/cover-letters")
async def batch_cover_letters(
    files: list[UploadFile] = File(...),
    resume_text: str = Form(...),
    openai_api_key: str = Form(...),
):
    # Read uploads
    jobs = []
    for f in files:
        filename = f.filename or "unknown.pdf"
        pdf_bytes = await f.read()
        jobs.append(analyze_pdf_bytes(pdf_bytes, filename))  # includes job_text

    # Build ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for job in jobs:
            posting_id = job.get("posting_id") or job.get("filename", "unknown")
            letter = generate_cover_letter(
                job=job,
                resume_text=resume_text,
                api_key=openai_api_key
            )
            z.writestr(f"{posting_id}.txt", letter)

    zip_bytes = zip_buffer.getvalue()

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="cover_letters.zip"'},
    )
