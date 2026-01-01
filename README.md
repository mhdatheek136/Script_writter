# Slide-to-Narration Rewriter

A lightweight internal web tool that rewrites PowerPoint presentations using Google's Gemini 2.5 Flash API. The tool processes each slide, generates improved content, extracts existing speaker notes, then creates a smooth, flowing narration script.

## Features

- **PPTX Processing**: Upload and process PowerPoint files
- **AI-Powered Rewriting**: Uses Gemini 2.5 Flash to improve slide content
- **Speaker Notes Extraction**: Extracts existing speaker notes from PowerPoint slides
- **Flowing Narration**: Generates cohesive narration paragraphs that flow across slides
- **Customizable**: Adjust tone, audience level, word count, and notes length
- **Stateless**: No permanent storage - all files are deleted after processing
- **Dockerized**: Easy deployment with Docker and docker-compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Setup

1. Clone or download this repository

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

5. Open your browser to `http://localhost:8000`

## Usage

1. **Upload**: Select a `.pptx` file from your computer
2. **Configure**: Set your preferences:
   - Target tone (Professional, Friendly, Sales, Technical)
   - Audience level (General, Executive, Technical)
   - Max words per slide (20-200)
   - Notes length (Short, Medium, Detailed)
3. **Process**: Click "Process Presentation" and wait for results
4. **Review**: View rewritten content, speaker notes, and narration for each slide
5. **Export**: Copy individual slides or all results, or download as JSON

## API Endpoints

- `GET /` - Main UI
- `POST /api/process` - Process a PowerPoint file
- `GET /health` - Health check endpoint

## Configuration

Environment variables (set in `.env`):

- `GEMINI_API_KEY` (required) - Your Gemini API key
- `GEMINI_MODEL` (optional) - Model name, default: `gemini-2.5-flash`
- `MAX_FILE_SIZE_MB` (optional) - Maximum file size in MB, default: 50
- `MAX_SLIDES` (optional) - Maximum number of slides, default: 30

## Architecture

- **Backend**: FastAPI with async processing
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: Google Gemini 2.5 Flash API
- **Image Processing**: Pillow for slide-to-image conversion
- **PPTX Parsing**: python-pptx library

## Processing Pipeline

1. **Upload & Validation**: Validates file type and size
2. **Slide Conversion**: Converts each slide to an image representation and extracts speaker notes from PPTX
3. **First Gemini Pass**: For each slide, generates rewritten slide content (speaker notes are extracted from PPTX, not generated)
4. **Second Gemini Pass**: Generates flowing narration paragraphs across all slides using rewritten content and extracted speaker notes
5. **Response & Cleanup**: Returns results and deletes all temporary files

## Limitations (MVP)

- Slide-to-image conversion uses a text-based approach (for production, consider using LibreOffice headless or python-pptx-render)
- Sequential processing (parallel processing can be added later)
- Maximum 30 slides by default
- Maximum 50MB file size by default

## Development

To run without Docker:

```bash
pip install -r requirements.txt
export GEMINI_API_KEY=your_key_here
uvicorn app.main:app --reload
```

## License

Internal tool - use as needed.

