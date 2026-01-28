from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class Tone(str, Enum):
    PROFESSIONAL = "Professional"
    FRIENDLY = "Friendly"
    SALES = "Sales"
    TECHNICAL = "Technical"


class AudienceLevel(str, Enum):
    GENERAL = "General"
    EXECUTIVE = "Executive"
    TECHNICAL = "Technical"


class NarrationStyle(str, Enum):
    HUMAN_LIKE = "Human-like"
    FORMAL = "Formal"
    CONCISE = "Concise"
    STORYTELLING = "Storytelling"
    CONVERSATIONAL = "Conversational"
    PROFESSIONAL = "Professional"


class ProcessRequest(BaseModel):
    tone: Tone = Tone.PROFESSIONAL
    audience_level: AudienceLevel = AudienceLevel.GENERAL
    max_words: int = Field(default=60, ge=20, le=200)
    narration_style: NarrationStyle = NarrationStyle.HUMAN_LIKE
    dynamic_length: bool = True
    include_speaker_notes: bool = True
    enable_polishing: bool = True
    min_words: Optional[int] = Field(default=100, ge=50, le=300)
    max_words_fixed: Optional[int] = Field(default=150, ge=100, le=400)
    custom_instructions: Optional[str] = None


class SlideOutput(BaseModel):
    slide_number: int
    original_content: str
    rewritten_content: str
    speaker_notes: str
    narration_paragraph: str
    polished_narration: Optional[str] = None
    image_url: Optional[str] = None


class OutputFile(BaseModel):
    format: str
    filename: str
    download_url: str
    size_kb: float


class ProcessResponse(BaseModel):
    success: bool
    total_slides: int
    slides: List[SlideOutput]
    session_id: Optional[str] = None
    base_name: Optional[str] = None
    narration_style: Optional[str] = None
    processing_summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None