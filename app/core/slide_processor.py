import logging
import tempfile
from pathlib import Path
from typing import List, Dict, Optional, Any
import shutil

from app.services.pptx_extractor import PPTXExtractor
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)

class SlideProcessor:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        """Initialize the slide processor with Gemini API."""
        self.llm_client = LLMClient(api_key, model_name)
        self.temp_dir = Path(tempfile.mkdtemp())
        self.extractor = PPTXExtractor(self.temp_dir)
        self.temp_files = [] 

    def _cleanup_temp_files(self):
        """Remove all temporary files and directories."""
        self.extractor.temp_files = self.extractor.temp_files + self.temp_files
        for file_path in self.extractor.temp_files:
            try:
                if file_path.exists():
                    if file_path.is_file():
                        file_path.unlink()
                    elif file_path.is_dir():
                        shutil.rmtree(file_path)
            except Exception as e:
                logger.warning(f"Could not delete {file_path}: {e}")

        if self.temp_dir and self.temp_dir.exists():
            try:
                shutil.rmtree(self.temp_dir)
            except Exception as e:
                logger.warning(f"Could not delete temp dir {self.temp_dir}: {e}")

    def process_pptx(
        self,
        pptx_path: Path,
        tone: str,
        audience_level: str,
        narration_style: str = "Human-like",
        dynamic_length: bool = True,
        include_speaker_notes: bool = True,
        enable_polishing: bool = True,
        min_words: Optional[int] = None,
        max_words_fixed: Optional[int] = None,
        custom_instructions: Optional[str] = None,
    ) -> Dict:
        """
        Main processing pipeline: convert PPTX, process slides, generate narration.
        """
        try:
            logger.info("=" * 60)
            logger.info("Starting PPTX processing pipeline")
            logger.info(f"File: {pptx_path}")
            logger.info(f"Tone: {tone}, Audience: {audience_level}")
            logger.info(f"Style: {narration_style}, Dynamic: {dynamic_length}, Polish: {enable_polishing}")
            if custom_instructions:
                logger.info(f"Custom Instructions: {custom_instructions}")
            logger.info("=" * 60)
            
            # self.temp_files.append(pptx_path) - Do not delete input file, let caller handle it

            logger.info("\n[STEP 1] Converting PPTX to images and extracting speaker notes...")
            image_paths, speaker_notes_list, original_text_list = self.extractor.pptx_to_images(pptx_path)

            if not image_paths:
                raise Exception("No slides found in presentation")

            logger.info(f"✓ Converted {len(image_paths)} slides to images\n")

            logger.info(f"[STEP 2] Processing {len(image_paths)} slides with Gemini...")
            slide_results = []
            for i, img_path in enumerate(image_paths, start=1):
                logger.info(f"\n--- Processing Slide {i}/{len(image_paths)} ---")
                
                rewritten_content = self.llm_client.process_slide_with_gemini(
                    img_path, i, tone, audience_level
                )

                # Handle speaker notes toggle
                current_notes = ""
                if include_speaker_notes:
                    current_notes = speaker_notes_list[i - 1] if i - 1 < len(speaker_notes_list) else ""
                    if not isinstance(current_notes, str):
                        current_notes = str(current_notes)
                
                # Get original text
                current_original_text = original_text_list[i - 1] if i - 1 < len(original_text_list) else ""

                slide_results.append(
                    {
                        "slide_number": i,
                        "original_content": current_original_text,
                        "rewritten_content": rewritten_content,
                        "speaker_notes": current_notes,
                    }
                )

                logger.info(f"✓ Slide {i} processed successfully")
                logger.info(f"  Rewritten content length: {len(rewritten_content)} chars")
                logger.info(f"  Speaker notes length: {len(current_notes)} chars")

            logger.info(f"\n✓ All {len(slide_results)} slides processed\n")

            logger.info("[STEP 3] Generating flowing narration...")
            narration_paragraphs = self.llm_client.generate_narration(
                slide_results,
                tone,
                narration_style=narration_style,
                dynamic_length=dynamic_length,
                custom_instructions=custom_instructions
            )

            if len(narration_paragraphs) != len(slide_results):
                logger.error(
                    f"CRITICAL ERROR: Narration count ({len(narration_paragraphs)}) "
                    f"doesn't match slide count ({len(slide_results)})"
                )
                while len(narration_paragraphs) < len(slide_results):
                    narration_paragraphs.append("")
                narration_paragraphs = narration_paragraphs[: len(slide_results)]
                logger.warning(f"Adjusted narration array to match {len(slide_results)} slides")

            logger.info(
                f"✓ Generated {len(narration_paragraphs)} narration paragraphs (validated: one per slide)\n"
            )

            if enable_polishing:
                logger.info("[STEP 3.5] Refining narration flow...")
                narrations_to_refine = []
                for idx, narr in enumerate(narration_paragraphs):
                    if idx < len(slide_results):
                        s_num = slide_results[idx]["slide_number"]
                        narrations_to_refine.append({
                            "slide_number": s_num,
                            "narration": narr
                        })
                
                if narrations_to_refine:
                    narration_paragraphs = self.llm_client.refine_narrations_flow(narrations_to_refine, tone)
                    logger.info(f"✓ Refined {len(narration_paragraphs)} narration paragraphs")
            else:
                logger.info("[STEP 3.5] Skipping narration refinement (polishing disabled)")

            logger.info("[STEP 4] Combining results with strict slide-to-narration mapping...")
            final_results = []
            for idx, slide_res in enumerate(slide_results):
                # Ensure we have a narration for this slide
                narration = ""
                if idx < len(narration_paragraphs):
                    narration = narration_paragraphs[idx]
                
                final_results.append({
                    **slide_res,
                    "narration_paragraph": narration
                })

            logger.info("=" * 60)
            logger.info("Processing complete!")
            logger.info(f"Total slides processed: {len(final_results)}")
            logger.info("=" * 60)
            
            # Clean up immediately after processing
            logger.info("Cleaning up temporary files...")
            self._cleanup_temp_files()
            logger.info("Cleanup complete")

            return {
                "success": True,
                "total_slides": len(final_results),
                "slides": final_results
            }

        except Exception as e:
            logger.error(f"Processing failed: {str(e)}")
            self._cleanup_temp_files()
            return {
                "success": False,
                "error": str(e),
                "slides": []
            }
