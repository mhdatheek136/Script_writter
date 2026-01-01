from pydantic import BaseModel, Field
from typing import Optional, List
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


class NotesLength(str, Enum):
    SHORT = "Short"
    MEDIUM = "Medium"
    DETAILED = "Detailed"


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
    max_words_per_slide: int = Field(default=60, ge=20, le=200)
    notes_length: NotesLength = NotesLength.MEDIUM
    narration_style: NarrationStyle = NarrationStyle.HUMAN_LIKE
    dynamic_length: bool = True


class SlideOutput(BaseModel):
    slide_number: int
    rewritten_content: str
    speaker_notes: str
    narration_paragraph: str


class ProcessResponse(BaseModel):
    success: bool
    total_slides: int
    slides: List[SlideOutput]
    overall_summary: Optional[str] = None
    error: Optional[str] = None

