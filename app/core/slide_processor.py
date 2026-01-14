import logging
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
import shutil

from app.services.pptx_extractor import PPTXExtractor
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class SlideProcessor:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash", timeout_per_slide: int = 60):
        """Initialize the slide processor with Gemini API."""
        self.llm_client = LLMClient(api_key, model_name)
        self.temp_dir = Path(tempfile.mkdtemp())
        self.extractor = PPTXExtractor(self.temp_dir)
        self.timeout_per_slide = timeout_per_slide  # Timeout in seconds per slide
        self.max_retries = 3  # Maximum retries for failed slide processing

    def _cleanup_temp_files(self):
        """Remove all temporary files and directories."""
        # Get all temp files from extractor
        all_temp_files = getattr(self.extractor, 'temp_files', [])
        
        # Clean individual files
        for file_path in all_temp_files:
            try:
                if file_path.exists():
                    if file_path.is_file():
                        file_path.unlink()
                    elif file_path.is_dir():
                        shutil.rmtree(file_path)
            except Exception as e:
                logger.warning(f"Could not delete {file_path}: {e}")

        # Clean main temp directory
        if hasattr(self, 'temp_dir') and self.temp_dir and self.temp_dir.exists():
            try:
                shutil.rmtree(self.temp_dir)
            except Exception as e:
                logger.warning(f"Could not delete temp dir {self.temp_dir}: {e}")

    def _process_single_slide_with_retry(
        self,
        img_path: Path,
        slide_num: int,
        tone: str,
        audience_level: str
    ) -> str:
        """Process a single slide with retry logic and timeout handling."""
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                logger.info(f"Processing slide {slide_num}, attempt {attempt + 1}/{self.max_retries}")
                
                # Process slide with timeout consideration
                rewritten_content = self.llm_client.process_slide_with_gemini(
                    img_path, slide_num, tone, audience_level
                )
                
                return rewritten_content
                
            except Exception as e:
                last_exception = e
                error_msg = str(e)
                
                # Check for timeout errors
                if any(timeout_indicator in error_msg for timeout_indicator in ["504", "Deadline", "timeout", "Timeout"]):
                    logger.warning(f"Timeout on slide {slide_num}, attempt {attempt + 1}")
                    if attempt < self.max_retries - 1:
                        # Exponential backoff with jitter
                        wait_time = min(5 * (2 ** attempt) + (0.1 * attempt), 30)  # Max 30 seconds
                        logger.info(f"Waiting {wait_time:.1f} seconds before retry...")
                        time.sleep(wait_time)
                        continue
                
                # For non-timeout errors, break immediately
                logger.error(f"Non-retryable error on slide {slide_num}: {error_msg}")
                break
        
        # If we get here, all retries failed
        if last_exception:
            logger.error(f"Failed to process slide {slide_num} after {self.max_retries} attempts")
            raise last_exception
        else:
            raise Exception(f"Unknown error processing slide {slide_num}")

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
            logger.info(f"Timeout per slide: {self.timeout_per_slide}s, Max retries: {self.max_retries}")
            logger.info("=" * 60)
            
            # Step 1: Convert PPTX to images
            logger.info("\n[STEP 1] Converting PPTX to images and extracting speaker notes...")
            image_paths, speaker_notes_list, original_text_list = self.extractor.pptx_to_images(pptx_path)

            if not image_paths:
                raise Exception("No slides found in presentation")

            logger.info(f"✓ Converted {len(image_paths)} slides to images\n")

            # Step 2: Process slides with Gemini (with retry logic)
            logger.info(f"[STEP 2] Processing {len(image_paths)} slides with Gemini...")
            slide_results = []
            failed_slides = []
            
            for i, img_path in enumerate(image_paths, start=1):
                logger.info(f"\n--- Processing Slide {i}/{len(image_paths)} ---")
                
                try:
                    # Use retry logic for processing
                    rewritten_content = self._process_single_slide_with_retry(
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
                    
                except Exception as e:
                    logger.error(f"✗ Failed to process slide {i}: {str(e)}")
                    failed_slides.append(i)
                    
                    # Add placeholder for failed slide
                    slide_results.append(
                        {
                            "slide_number": i,
                            "original_content": original_text_list[i - 1] if i - 1 < len(original_text_list) else "",
                            "rewritten_content": f"[Error processing slide: {str(e)[:100]}]",
                            "speaker_notes": speaker_notes_list[i - 1] if i - 1 < len(speaker_notes_list) else "",
                        }
                    )
                    continue

            # Check if too many slides failed
            if failed_slides:
                logger.warning(f"Failed to process {len(failed_slides)} slides: {failed_slides}")
                if len(failed_slides) > len(image_paths) / 2:  # More than half failed
                    raise Exception(f"Too many slides failed to process: {len(failed_slides)}/{len(image_paths)}")

            logger.info(f"\n✓ Processed {len(slide_results) - len(failed_slides)}/{len(slide_results)} slides successfully\n")

            # Step 3: Generate flowing narration
            logger.info("[STEP 3] Generating flowing narration...")
            try:
                narration_paragraphs = self.llm_client.generate_narration(
                    slide_results,
                    tone,
                    narration_style=narration_style,
                    dynamic_length=dynamic_length,
                    custom_instructions=custom_instructions
                )

                if len(narration_paragraphs) != len(slide_results):
                    logger.warning(
                        f"Narration count ({len(narration_paragraphs)}) "
                        f"doesn't match slide count ({len(slide_results)})"
                    )
                    # Adjust narration array to match slide count
                    if len(narration_paragraphs) < len(slide_results):
                        narration_paragraphs.extend([""] * (len(slide_results) - len(narration_paragraphs)))
                    else:
                        narration_paragraphs = narration_paragraphs[:len(slide_results)]
                    
                    logger.info(f"Adjusted narration array to {len(narration_paragraphs)} paragraphs")

                logger.info(f"✓ Generated {len(narration_paragraphs)} narration paragraphs\n")
                
            except Exception as e:
                logger.error(f"Failed to generate narration: {str(e)}")
                # Create empty narration paragraphs
                narration_paragraphs = [""] * len(slide_results)

            # Step 4: Polish narration if enabled
            if enable_polishing:
                logger.info("[STEP 4] Refining narration flow...")
                try:
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
                except Exception as e:
                    logger.error(f"Failed to polish narration: {str(e)}")
                    logger.info("Continuing with unpolished narration...")
            else:
                logger.info("[STEP 4] Skipping narration refinement (polishing disabled)")

            # Step 5: Combine results
            logger.info("[STEP 5] Combining results...")
            final_results = []
            for idx, slide_res in enumerate(slide_results):
                narration = narration_paragraphs[idx] if idx < len(narration_paragraphs) else ""
                
                final_results.append({
                    **slide_res,
                    "narration_paragraph": narration,
                    "processing_status": "success" if slide_res["slide_number"] not in failed_slides else "failed"
                })

            # Summary
            logger.info("=" * 60)
            logger.info("Processing complete!")
            logger.info(f"Total slides: {len(final_results)}")
            logger.info(f"Successfully processed: {len(final_results) - len(failed_slides)}")
            logger.info(f"Failed slides: {len(failed_slides)}")
            if failed_slides:
                logger.info(f"Failed slide numbers: {failed_slides}")
            logger.info("=" * 60)
            
            # Cleanup
            logger.info("Cleaning up temporary files...")
            self._cleanup_temp_files()
            logger.info("Cleanup complete")

            return {
                "success": True,
                "total_slides": len(final_results),
                "processed_successfully": len(final_results) - len(failed_slides),
                "failed_slides": failed_slides,
                "slides": final_results
            }

        except Exception as e:
            logger.error(f"Processing failed: {str(e)}")
            # Cleanup on failure
            try:
                self._cleanup_temp_files()
            except Exception as cleanup_error:
                logger.warning(f"Error during cleanup: {cleanup_error}")
            
            return {
                "success": False,
                "error": str(e),
                "slides": []
            }

    def __del__(self):
        """Destructor to ensure cleanup."""
        try:
            self._cleanup_temp_files()
        except:
            pass  # Ignore errors during destruction