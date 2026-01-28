import os
import uuid
import shutil
import logging
import tempfile
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from contextlib import asynccontextmanager

from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import ProcessResponse
from app.core.slide_processor import SlideProcessor
from app.output_generator import OutputGenerator
from app.core.progress_tracker import ProgressStore

# Import new routers
from app.routers import auth_router, admin_router, projects_router, files_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_default_admin():
    """Create default admin user if it doesn't exist."""
    from app.database import SessionLocal
    from app.models.db_models import User, UserRole
    from app.auth.security import get_password_hash
    
    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com")
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "changeme123")
    
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == admin_email).first()
        if not existing:
            admin = User(
                email=admin_email,
                hashed_password=get_password_hash(admin_password),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            logger.info(f"Default admin user created: {admin_email}")
        else:
            logger.info(f"Admin user already exists: {admin_email}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info("Starting up Script Writer application...")
    
    # Initialize database
    from app.database import init_db
    init_db()
    logger.info("Database initialized")
    
    # Create default admin
    create_default_admin()
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="Slide-to-Narration Rewriter",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(projects_router)
app.include_router(files_router)

# Get configuration from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024
MAX_SLIDES = int(os.getenv("MAX_SLIDES", "30"))

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Create directories
BASE_TMP = Path(os.getenv("TEMP_BASE_DIR", "/tmp"))

temp_output_dir = BASE_TMP / "temp_outputs"
temp_output_dir.mkdir(parents=True, exist_ok=True)

temp_upload_dir = BASE_TMP / "temp_uploads"
temp_upload_dir.mkdir(parents=True, exist_ok=True)


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


def run_processing_background(
    session_id: str,
    file_path: Path,
    params: Dict[str, Any],
    api_key: str,
    model: str,
    project_id: Optional[str] = None
):
    """
    Background worker to run the slide processor and save results.
    """
    store = ProgressStore()
    
    # 1. Resolve user and Upload Source File (Fail Fast)
    user_id = None
    file_record_id = None
    
    if project_id:
        try:
            from app.database import SessionLocal
            from app.models.db_models import Project, FileRecord, FileType
            from app.services.s3_storage import S3StorageService
            import datetime

            db_pre = SessionLocal()
            try:
                project = db_pre.query(Project).filter(Project.id == project_id).first()
                if project:
                    user_id = project.user_id
                    
                    # Upload original file to S3 immediately
                    s3 = S3StorageService()
                    s3_key = s3.upload_file(
                        file_path, 
                        project.user_id, 
                        project.id, 
                        "uploads",
                        file_path.name
                    )
                    
                    if s3_key:
                        # Create FileRecord immediately
                        file_record_id = str(uuid.uuid4())
                        file_record = FileRecord(
                            id=file_record_id,
                            user_id=project.user_id,
                            project_id=project.id,
                            filename=file_path.name,
                            s3_key=s3_key,
                            file_type=FileType.SOURCE,
                            size_bytes=file_path.stat().st_size
                        )
                        db_pre.add(file_record)
                        
                        # Update project updated_at
                        project.updated_at = datetime.datetime.utcnow()
                        db_pre.commit()
                        logger.info(f"Uploaded source file and created record {file_record_id} for project {project_id}")
                    else:
                        logger.error(f"Failed to upload source file for project {project_id}")
            except Exception as e:
                 logger.error(f"Error in pre-processing (upload): {e}")
            finally:
                db_pre.close()

        except Exception as e:
            logger.error(f"Failed to resolve user/project {project_id}: {e}")

    try:
        processor = SlideProcessor(api_key, model)
        result = processor.process_pptx(
            file_path,
            session_id=session_id,
            user_id=user_id,
            project_id=project_id,
            **params
        )
        
        # Save result to session file (local temp backup)
        result_path = temp_output_dir / f"{session_id}_result.json"
        
        # Inject base_name if missing
        if "base_name" not in result:
           result["base_name"] = file_path.stem

        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(result, f, default=str)
        
        # 3. Save AI Output to DB
        if project_id and file_record_id:
            try:
                from app.database import SessionLocal
                from app.models.db_models import AIOutput
                import datetime
                
                db_post = SessionLocal()
                try:
                    # Create AIOutput linked to the FileRecord we created earlier
                    output = AIOutput(
                        id=str(uuid.uuid4()),
                        user_id=user_id, # We have this from before
                        project_id=project_id,
                        file_record_id=file_record_id,
                        slides_data=result.get("slides", []),
                        settings=params,
                        status="completed"
                    )
                    db_post.add(output)
                    db_post.commit()
                    logger.info(f"Saved AI output to project {project_id}")
                except Exception as e:
                    logger.error(f"Failed to save AI output: {e}")
                finally:
                    db_post.close()
            except Exception as e:
                logger.error(f"Failed to open DB for saving output: {e}")
            
        store.update(session_id, "complete", 100, "Ready")
        
    except Exception as e:
        logger.error(f"Background processing failed for {session_id}: {e}")
        store.update(session_id, "failed", 0, str(e))


@app.get("/", response_class=FileResponse)
async def root():
    """Serve the main UI."""
    index_path = Path(__file__).parent.parent / "frontend" / "dist" / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    raise HTTPException(status_code=404, detail="React build not found. Please run 'npm run build' in the frontend directory.")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "model": GEMINI_MODEL}





class RefineRequest(BaseModel):
    current_text: str
    instruction: str
    slide_context: str

    tone: str = "Professional"
    style: str = "Human-like"


@app.post("/api/refine-narration")
async def refine_narration(request: RefineRequest):
    """
    Refine narration based on user instruction (JSON).
    """
    try:
        logger.info(f"=== NARRATION REFINE REQUEST ===")
        logger.info(f"Instruction: {request.instruction}")
        
        if not request.instruction.strip():
            raise HTTPException(status_code=400, detail="Instruction cannot be empty")
            
        from app.services.llm_client import LLMClient
        llm_client = LLMClient(GEMINI_API_KEY, GEMINI_MODEL)
        
        new_narration = llm_client.rewrite_narration(
            current_narration=request.current_text,
            rewritten_content=request.slide_context,
            speaker_notes="",
            user_request=request.instruction,

            tone=request.tone,
            style=request.style
        )
        
        return JSONResponse({
            "success": True,
            "refined_text": new_narration
        })
        
    except Exception as e:
        logger.error(f"Refine failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/global-rewrite")
async def global_rewrite(
    user_request: str = Form(...),
    slides_json: str = Form(...),
    tone: str = Form("Professional"),
    style: str = Form("Human-like")
):
    """
    Rewrite all narrations based on a global user request.
    """
    try:
        import json
        slides = json.loads(slides_json)
        
        logger.info(f"=== GLOBAL REWRITE REQUEST ===")
        logger.info(f"User request: {user_request}")
        
        if not user_request.strip():
            raise HTTPException(status_code=400, detail="User request cannot be empty")
            
        from app.services.llm_client import LLMClient
        llm_client = LLMClient(GEMINI_API_KEY, GEMINI_MODEL)
        
        updated_slides = llm_client.perform_global_rewrite(
            slide_data=slides,
            user_request=user_request,

            tone=tone,
            style=style
        )
        
        return JSONResponse({
            "success": True,
            "slides": updated_slides
        })
        
    except Exception as e:
        logger.error(f"Global rewrite failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process")
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
    max_words_fixed: int = Form(150),
    custom_instructions: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None)
):
    """
    Async upload: returns session_id immediately. Client should poll /api/progress/{session_id}.
    """
    logger.info("=" * 80)
    logger.info("NEW REQUEST RECEIVED (Async)")
    logger.info(f"File: {file.filename}")
    
    # Run cleanup
    background_tasks.add_task(cleanup_old_files)
    
    if not file.filename.endswith('.pptx'):
        raise HTTPException(status_code=400, detail="Only .pptx files are supported")
    
    session_id = str(uuid.uuid4())
    base_name = Path(file.filename).stem
    
    # Save file
    session_upload_path = temp_upload_dir / f"{session_id}.pptx"
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
        
    with open(session_upload_path, "wb") as f:
        f.write(file_content)
    
    # Prepare params
    params = {
        "tone": tone,
        "audience_level": audience_level,
        "narration_style": narration_style,
        "dynamic_length": dynamic_length,
        "include_speaker_notes": include_speaker_notes,
        "enable_polishing": enable_polishing,
        "min_words": min_words if not dynamic_length else None,
        "max_words_fixed": max_words_fixed if not dynamic_length else None,
        "custom_instructions": custom_instructions
    }
    
    # Start background task
    background_tasks.add_task(
        run_processing_background,
        session_id,
        session_upload_path,
        params,
        GEMINI_API_KEY,
        GEMINI_MODEL,
        project_id
    )
    
    ProgressStore().update(session_id, "queued", 0, "Request accepted")
    
    return {
        "success": True, 
        "session_id": session_id,
        "base_name": base_name,
        "message": "Processing started"
    }


@app.get("/api/result/{session_id}", response_model=ProcessResponse)
async def get_result(session_id: str):
    """
    Get final processing result for a session.
    """
    import json
    result_path = temp_output_dir / f"{session_id}_result.json"
    
    store = ProgressStore()
    status = store.get(session_id)
    
    if status["status"] == "failed":
         return ProcessResponse(
            success=False,
            total_slides=0,
            slides=[],
            error=status.get("details", "Processing failed")
        )

    if not result_path.exists():
        if status["status"] == "unknown":
            raise HTTPException(status_code=404, detail="Session not found")
        else:
            # Still running
            raise HTTPException(status_code=202, detail="Processing in progress")
            
    try:
        with open(result_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        data["session_id"] = session_id
        if "base_name" not in data:
            data["base_name"] = "presentation" 
            
        return ProcessResponse(**data)
        
    except Exception as e:
        logger.error(f"Failed to read result: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve result")


@app.post("/api/generate-output")
async def generate_output(
    session_id: str = Form(...),
    base_name: str = Form(...),
    format_type: str = Form(...),
    slides_json: str = Form(...)
):
    """
    Generate a specific output format.
    """
    try:
        import json
        slides = json.loads(slides_json)
        
        result = {
            "slides": slides,
            "success": True
        }
        
        output_generator = OutputGenerator()
        generated_path = None 
        
        if format_type == "json":
            generated_path = output_generator.generate_json(result, base_name)
        elif format_type == "txt":
            generated_path = output_generator.generate_text(result, base_name)
        elif format_type == "docx":
            generated_path = output_generator.generate_word(result, base_name)
        elif format_type == "pptx":
            session_upload_path = temp_upload_dir / f"{session_id}.pptx"
            if not session_upload_path.exists():
                raise HTTPException(status_code=404, detail="Original presentation not found. Please re-process.")
            generated_path = output_generator.generate_pptx_with_notes(
                session_upload_path, result, base_name
            )
        
        if not generated_path:
            raise HTTPException(status_code=400, detail="Invalid format or generation failed")
        
        return FileResponse(
            path=str(generated_path),
            filename=generated_path.name,
            media_type="application/octet-stream"
        )
        
    except Exception as e:
        logger.error(f"On-demand generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """Download a generated file."""
    file_path = temp_output_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        filename=Path(filename).name,
        media_type="application/octet-stream"
    )

@app.get("/api/progress/{session_id}")
async def get_progress(session_id: str):
    """Get progress status for a session."""
    store = ProgressStore()
    return store.get(session_id)

@app.get("/api/images/{session_id}/{filename}")
async def get_slide_image(session_id: str, filename: str):
    """Serve a slide image from the session directory."""
    # Use consistent temp_output_dir logic defined at top of main.py
    # temp_output_dir = BASE_TMP / "temp_outputs"
    file_path = temp_output_dir / session_id / "images" / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
        
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="image/png"
    )

# Mount static files (for CSS and JS)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist" / "assets"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist), name="assets")

@app.get("/{rest_of_path:path}")
async def serve_frontend(rest_of_path: str):
    dist_dir = Path(__file__).parent.parent / "frontend" / "dist"
    file_path = dist_dir / rest_of_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    # Default to index.html for React routing
    index_path = dist_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    raise HTTPException(status_code=404, detail="Not Found")