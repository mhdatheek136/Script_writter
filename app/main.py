import os
import uuid
import shutil
import logging
import tempfile
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, List, Dict, Any
from app.models import ProcessResponse
from app.core.slide_processor import SlideProcessor
from app.output_generator import OutputGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Slide-to-Narration Rewriter")

# Get configuration from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024
MAX_SLIDES = int(os.getenv("MAX_SLIDES", "30"))

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")


@app.get("/", response_class=FileResponse)
async def root():
    """Serve the main UI."""
    return FileResponse("static/index.html")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "model": GEMINI_MODEL}


@app.post("/api/rewrite-narration")
async def rewrite_narration(
    slide_number: int = Form(...),
    current_narration: str = Form(...),
    rewritten_content: str = Form(...),
    speaker_notes: str = Form(""),
    user_request: str = Form(...),
    tone: str = Form("Professional")
):
    """
    Rewrite a single narration based on user request.
    """
    try:
        logger.info(f"=== NARRATION REWRITE REQUEST ===")
        logger.info(f"Slide: {slide_number}")
        logger.info(f"User request: {user_request}")
        logger.info(f"Tone: {tone}")
        
        # Validate request
        if not user_request.strip():
            raise HTTPException(status_code=400, detail="User request cannot be empty")
        
        # Create LLM client
        from app.services.llm_client import LLMClient
        llm_client = LLMClient(GEMINI_API_KEY, GEMINI_MODEL)
        
        # Call rewrite method
        new_narration = llm_client.rewrite_narration(
            current_narration=current_narration,
            rewritten_content=rewritten_content,
            speaker_notes=speaker_notes,
            user_request=user_request,
            tone=tone
        )
        
        logger.info(f"Rewrite successful for slide {slide_number}")
        
        return JSONResponse({
            "success": True,
            "slide_number": slide_number,
            "rewritten_narration": new_narration
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rewrite failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to rewrite narration: {str(e)}")


@app.post("/api/process", response_model=ProcessResponse)
async def process_presentation(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tone: str = Form("Professional"),
    audience_level: str = Form("General"),
    narration_style: str = Form("Human-like"),
    dynamic_length: bool = Form(True),
    include_speaker_notes: bool = Form(True),
    enable_polishing: bool = Form(True),
    min_words: int = Form(100),
    max_words_fixed: int = Form(150)
):
    """
    Process a PowerPoint file and return rewritten content, speaker notes, and narration.
    """
    logger.info("=" * 80)
    logger.info("NEW REQUEST RECEIVED")
    logger.info(f"File: {file.filename}")
    logger.info(f"Tone: {tone}, Audience: {audience_level}")
    logger.info("=" * 80)
    
    # Run cleanup of old files in background
    background_tasks.add_task(cleanup_old_files)
    
    # Validate file
    if not file.filename.endswith('.pptx'):
        logger.error(f"Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Only .pptx files are supported")
    
    # Generate session ID and temp paths
    session_id = str(uuid.uuid4())
    base_name = Path(file.filename).stem
    
    # Save uploaded file to persistent temp storage for this session
    session_upload_path = temp_upload_dir / f"{session_id}.pptx"
    
    # Validate file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        logger.error(f"File size exceeds maximum")
        raise HTTPException(status_code=400, detail="File too large")
        
    with open(session_upload_path, "wb") as f:
        f.write(file_content)
    
    logger.info(f"Saved session file to: {session_upload_path}")
    
    try:
        # Initialize processor
        processor = SlideProcessor(GEMINI_API_KEY, GEMINI_MODEL)
        
        # Process the presentation
        result = processor.process_pptx(
            session_upload_path,
            tone=tone,
            audience_level=audience_level,
            narration_style=narration_style,
            dynamic_length=dynamic_length,
            include_speaker_notes=include_speaker_notes,
            enable_polishing=enable_polishing,
            min_words=min_words if not dynamic_length else None,
            max_words_fixed=max_words_fixed if not dynamic_length else None
        )
        
        if result["success"]:
            # Validate slide count
            if result["total_slides"] > MAX_SLIDES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Presentation has {result['total_slides']} slides, maximum is {MAX_SLIDES}"
                )
            
            # Return session info and slide data
            # No files generated yet!
            result["session_id"] = session_id
            result["base_name"] = base_name
            
            logger.info("Returning results with session ID")
            return ProcessResponse(**result)
        else:
            return ProcessResponse(
                success=False,
                total_slides=0,
                slides=[],
                error=result.get("error", "Processing failed")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return ProcessResponse(
            success=False,
            total_slides=0,
            slides=[],
            error=str(e)
        )


@app.post("/api/generate-output")
async def generate_output(
    session_id: str = Form(...),
    base_name: str = Form(...),
    format_type: str = Form(...),
    slides_json: str = Form(...)
):
    """
    Generate a specific output format on-demand using current slide data.
    """
    try:
        import json
        slides = json.loads(slides_json)
        
        result = {
            "slides": slides,
            "success": True
        }
        
        output_generator = OutputGenerator()
        generated_filename = None
        
        if format_type == "json":
            generated_filename = output_generator.generate_json(result, base_name)
        elif format_type == "txt":
            generated_filename = output_generator.generate_text(result, base_name)
        elif format_type == "docx":
            generated_filename = output_generator.generate_word(result, base_name)
        elif format_type == "pptx":
            session_upload_path = temp_upload_dir / f"{session_id}.pptx"
            if not session_upload_path.exists():
                raise HTTPException(status_code=404, detail="Original presentation not found. Please re-process.")
            generated_filename = output_generator.generate_pptx_with_notes(
                session_upload_path, result, base_name
            )
        
        if not generated_filename:
            raise HTTPException(status_code=400, detail="Invalid format or generation failed")
            
        file_path = Path("temp_outputs") / generated_filename
        
        return FileResponse(
            path=file_path,
            filename=generated_filename,
            media_type="application/octet-stream"
        )
        
    except Exception as e:
        logger.error(f"On-demand generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """Download a generated file."""
    file_path = Path("temp_outputs") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )


# Mount static files (for CSS and JS)
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
# Create directories
temp_output_dir = Path("temp_outputs")
temp_output_dir.mkdir(exist_ok=True)

temp_upload_dir = Path("temp_uploads")
temp_upload_dir.mkdir(exist_ok=True)


def cleanup_old_files():
    """Delete files older than 1 hour in temp directories."""
    import time
    now = time.time()
    cutoff = now - 3600  # 1 hour ago
    
    for directory in [temp_output_dir, temp_upload_dir]:
        if not directory.exists():
            continue
        for file_path in directory.glob("*"):
            try:
                if file_path.stat().st_mtime < cutoff:
                    if file_path.is_file():
                        file_path.unlink()
                    elif file_path.is_dir():
                        shutil.rmtree(file_path)
                    logger.info(f"Cleaned up old file/dir: {file_path}")
            except Exception as e:
                logger.error(f"Error during cleanup of {file_path}: {e}")