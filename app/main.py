import os
import logging
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import tempfile
from app.models import ProcessRequest, ProcessResponse, Tone, AudienceLevel, NotesLength
from app.processors import SlideProcessor

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
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024  # Convert MB to bytes
MAX_SLIDES = int(os.getenv("MAX_SLIDES", "30"))

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main UI."""
    html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Slide-to-Narration Rewriter</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Slide-to-Narration Rewriter</h1>
            <p>Upload a PowerPoint file to rewrite slides and generate narration</p>
        </header>
        
        <main>
            <form id="uploadForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label for="file">PowerPoint File (.pptx)</label>
                    <input type="file" id="file" name="file" accept=".pptx" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="tone">Target Tone</label>
                        <select id="tone" name="tone">
                            <option value="Professional">Professional</option>
                            <option value="Friendly">Friendly</option>
                            <option value="Sales">Sales</option>
                            <option value="Technical">Technical</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="audience_level">Audience Level</label>
                        <select id="audience_level" name="audience_level">
                            <option value="General">General</option>
                            <option value="Executive">Executive</option>
                            <option value="Technical">Technical</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="max_words">Max Words per Slide</label>
                        <input type="number" id="max_words" name="max_words" value="60" min="20" max="200">
                    </div>
                    
                    <div class="form-group">
                        <label for="notes_length">Notes Length</label>
                        <select id="notes_length" name="notes_length">
                            <option value="Short">Short</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="Detailed">Detailed</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="narration_style">Narration Style</label>
                        <select id="narration_style" name="narration_style">
                            <option value="Human-like" selected>Human-like</option>
                            <option value="Formal">Formal</option>
                            <option value="Concise">Concise</option>
                            <option value="Storytelling">Storytelling</option>
                            <option value="Conversational">Conversational</option>
                            <option value="Professional">Professional</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="dynamic_length">Narration Length</label>
                        <div class="checkbox-group">
                            <input type="checkbox" id="dynamic_length" name="dynamic_length" checked>
                            <label for="dynamic_length" class="checkbox-label">Dynamic (adapts to content)</label>
                        </div>
                        <small class="form-hint">Uncheck for fixed length (100-150 words per slide)</small>
                    </div>
                </div>
                
                <button type="submit" id="processBtn">Process Presentation</button>
            </form>
            
            <div id="progress" class="hidden">
                <div class="spinner"></div>
                <p id="progressText">Processing...</p>
            </div>
            
            <div id="results" class="hidden">
                <h2>Results</h2>
                <div id="resultsContent"></div>
                <button id="copyAllBtn" class="copy-btn">Copy All Results</button>
                <button id="downloadJsonBtn" class="copy-btn">Download JSON</button>
            </div>
            
            <div id="error" class="error hidden"></div>
        </main>
    </div>
    
    <script src="/static/script.js"></script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "model": GEMINI_MODEL}


@app.post("/api/process", response_model=ProcessResponse)
async def process_presentation(
    file: UploadFile = File(...),
    tone: str = Form("Professional"),
    audience_level: str = Form("General"),
    max_words_per_slide: int = Form(60),
    notes_length: str = Form("Medium"),
    narration_style: str = Form("Human-like"),
    dynamic_length: bool = Form(True)
):
    """
    Process a PowerPoint file and return rewritten content, speaker notes, and narration.
    """
    logger.info("=" * 80)
    logger.info("NEW REQUEST RECEIVED")
    logger.info(f"File: {file.filename}")
    logger.info(f"Tone: {tone}, Audience: {audience_level}, Max words: {max_words_per_slide}")
    logger.info(f"Narration style: {narration_style}, Dynamic length: {dynamic_length}")
    logger.info("=" * 80)
    
    # Validate file
    if not file.filename.endswith('.pptx'):
        logger.error(f"Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Only .pptx files are supported")
    
    # Validate file size
    file_content = await file.read()
    file_size_mb = len(file_content) / (1024 * 1024)
    logger.info(f"File size: {file_size_mb:.2f} MB")
    
    if len(file_content) > MAX_FILE_SIZE:
        logger.error(f"File size {file_size_mb:.2f} MB exceeds maximum {MAX_FILE_SIZE / (1024*1024):.0f} MB")
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum of {MAX_FILE_SIZE / (1024*1024):.0f}MB"
        )
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pptx') as tmp_file:
        tmp_file.write(file_content)
        tmp_path = Path(tmp_file.name)
    
    logger.info(f"Saved uploaded file to: {tmp_path}")
    
    try:
        # Initialize processor
        logger.info("Initializing SlideProcessor...")
        processor = SlideProcessor(GEMINI_API_KEY, GEMINI_MODEL)
        
        # Process the presentation
        logger.info("Starting presentation processing...")
        logger.info(f"Narration style: {narration_style}, Dynamic length: {dynamic_length}")
        result = processor.process_pptx(
            tmp_path,
            tone=tone,
            audience_level=audience_level,
            max_words=max_words_per_slide,
            notes_length=notes_length,
            narration_style=narration_style,
            dynamic_length=dynamic_length
        )
        
        logger.info(f"Processing complete. Success: {result.get('success', False)}")
        if result.get("success"):
            logger.info(f"Total slides: {result.get('total_slides', 0)}")
        else:
            logger.error(f"Processing failed: {result.get('error', 'Unknown error')}")
        
        # Validate slide count
        if result["success"] and result["total_slides"] > MAX_SLIDES:
            logger.error(f"Slide count {result['total_slides']} exceeds maximum {MAX_SLIDES}")
            raise HTTPException(
                status_code=400,
                detail=f"Presentation has {result['total_slides']} slides, maximum is {MAX_SLIDES}"
            )
        
        logger.info("Returning results to client...")
        return ProcessResponse(**result)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return ProcessResponse(
            success=False,
            total_slides=0,
            slides=[],
            error=str(e)
        )
    finally:
        # Cleanup uploaded file
        try:
            if tmp_path.exists():
                tmp_path.unlink()
                logger.info(f"Cleaned up uploaded file: {tmp_path}")
        except Exception as e:
            logger.warning(f"Failed to cleanup uploaded file: {e}")


# Mount static files (for CSS and JS)
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

