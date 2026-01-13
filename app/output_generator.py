import json
import logging
from pathlib import Path
from typing import Dict, Any, List
from docx import Document
from pptx import Presentation

logger = logging.getLogger(__name__)

class OutputGenerator:
    def __init__(self, output_dir: str = "temp_outputs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_json(self, result: Dict[str, Any], base_name: str) -> str:
        """Generate JSON output file."""
        try:
            filename = f"{base_name}_narration.json"
            file_path = self.output_dir / filename
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
                
            logger.info(f"Generated JSON output: {file_path}")
            return filename
        except Exception as e:
            logger.error(f"Failed to generate JSON output: {e}")
            raise

    def generate_text(self, result: Dict[str, Any], base_name: str) -> str:
        """Generate plain text output file."""
        try:
            filename = f"{base_name}_narration.txt"
            file_path = self.output_dir / filename
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"Narration Script for {base_name}\n")
                f.write("=" * 50 + "\n\n")
                
                for slide in result.get("slides", []):
                    slide_num = slide.get("slide_number", "?")
                    f.write(f"Slide {slide_num}\n")
                    f.write("-" * 20 + "\n")
                    f.write(f"Narration:\n{slide.get('narration_paragraph', '')}\n\n")
                    f.write(f"Notes:\n{slide.get('speaker_notes', '')}\n\n")
                    f.write("=" * 50 + "\n\n")
                    
            logger.info(f"Generated Text output: {file_path}")
            return filename
        except Exception as e:
            logger.error(f"Failed to generate Text output: {e}")
            raise

    def generate_word(self, result: Dict[str, Any], base_name: str) -> str:
        """Generate Word document output file."""
        try:
            filename = f"{base_name}_narration.docx"
            file_path = self.output_dir / filename
            
            doc = Document()
            doc.add_heading(f'Narration Script for {base_name}', 0)
            
            for slide in result.get("slides", []):
                slide_num = slide.get("slide_number", "?")
                doc.add_heading(f'Slide {slide_num}', level=1)
                
                doc.add_heading('Narration:', level=2)
                doc.add_paragraph(slide.get('narration_paragraph', ''))
                
                doc.add_heading('Speaker Notes:', level=2)
                doc.add_paragraph(slide.get('speaker_notes', ''))
                
                doc.add_page_break()
                
            doc.save(file_path)
            logger.info(f"Generated Word output: {file_path}")
            return filename
        except Exception as e:
            logger.error(f"Failed to generate Word output: {e}")
            raise

    def generate_pptx_with_notes(self, original_pptx: Path, result: Dict[str, Any], base_name: str) -> str:
        """Generate PPTX with updated speaker notes."""
        try:
            filename = f"{base_name}_with_narration.pptx"
            file_path = self.output_dir / filename
            
            prs = Presentation(original_pptx)
            
            # Map slide number to narration
            narration_map = {
                item["slide_number"]: item["narration_paragraph"] 
                for item in result.get("slides", [])
            }
            
            for i, slide in enumerate(prs.slides, start=1):
                if i in narration_map:
                    notes_slide = slide.notes_slide
                    text_frame = notes_slide.notes_text_frame
                    text_frame.text = narration_map[i]
            
            prs.save(file_path)
            logger.info(f"Generated PPTX output: {file_path}")
            return filename
        except Exception as e:
            logger.error(f"Failed to generate PPTX output: {e}")
            raise
