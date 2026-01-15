import logging
import tempfile
import time
import shutil
import os
from pathlib import Path
from typing import List, Dict, Optional, Any

from app.services.pptx_extractor import PPTXExtractor
from app.services.llm_client import LLMClient
from app.core.progress_tracker import ProgressStore

logger = logging.getLogger(__name__)


class SlideProcessor:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash", timeout_per_slide: int = 60):
        """Initialize the slide processor with Gemini API."""
        self.llm_client = LLMClient(api_key, model_name)
        self.temp_dir = Path(tempfile.mkdtemp())
        self.extractor = PPTXExtractor(self.temp_dir)
        self.timeout_per_slide = timeout_per_slide  # Timeout in seconds per slide
        self.max_retries = 3  # Maximum retries for failed slide processing
        self.progress_store = ProgressStore()

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
        img_path: Optional[Path],
        slide_num: int,
        tone: str,
        audience_level: str,
        slide_text_fallback: str = ""
    ) -> str:
        """Process a single slide with retry logic and timeout handling."""
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                logger.info(f"Processing slide {slide_num}, attempt {attempt + 1}/{self.max_retries}")
                
                # Process slide with timeout consideration
                if img_path:
                    rewritten_content = self.llm_client.process_slide_with_gemini(
                        img_path, slide_num, tone, audience_level
                    )
                else:
                    # Fallback if no image: we just return "Processed (No Image)" or similar until we have text-only logic
                    # Or we rely on the prompt which might be awkward without image.
                    # Since we don't have a text-only method in LLMClient yet, 
                    # we will just warn and return the original text as "rewritten" 
                    # or try to use a generic text processing if available.
                    # For now: Just pass the text through or error gently.
                    logger.warning(f"Slide {slide_num} has no image, using text as content.")
                    rewritten_content = f"Content: {slide_text_fallback}" 
                
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
        session_id: Optional[str] = None
    ) -> Dict:
        """
        Main processing pipeline: convert PPTX, process slides, generate narration.
        """
        session_id = session_id or "unknown_session"
        try:
            self.progress_store.update(session_id, "starting", 0, "Initializing processing pipeline...")
            
            logger.info("=" * 60)
            logger.info("Starting PPTX processing pipeline")
            logger.info(f"File: {pptx_path}")
            logger.info(f"Tone: {tone}, Audience: {audience_level}")
            
            # Step 1: Convert PPTX to images
            self.progress_store.update(session_id, "converting", 5, "Converting slides to images...")
            logger.info("\n[STEP 1] Converting PPTX to images and extracting speaker notes...")
            image_paths, speaker_notes_list, original_text_list = self.extractor.pptx_to_images(pptx_path)

            # Persist images if we have them and a session ID
            # Target dir: {TEMP_BASE_DIR}/temp_outputs/{session_id}/images
            persisted_image_paths = []
            if session_id and image_paths:
                # Use same logic as main.py
                base_tmp = Path(os.getenv("TEMP_BASE_DIR", "/tmp"))
                session_img_dir = base_tmp / "temp_outputs" / session_id / "images"
                session_img_dir.mkdir(parents=True, exist_ok=True)
                
                logger.info(f"DEBUG: Persisting {len(image_paths)} images to {session_img_dir}")
                
                for idx, img in enumerate(image_paths):
                    try:
                        dest = session_img_dir / img.name
                        shutil.copy2(img, dest)
                        persisted_image_paths.append(str(dest))
                        logger.info(f"DEBUG: Saved image {idx+1} to {dest}")
                    except Exception as copy_err:
                        logger.error(f"DEBUG: Failed to copy image {img} to {dest}: {copy_err}")
            else:
                 logger.warning(f"DEBUG: Skipping persistence. session_id={session_id}, image_paths count={len(image_paths)}")

            
            # If conversion failed fully (no images), we might have text only
            if not image_paths and not original_text_list:
                 raise Exception("No slides found in presentation (neither images nor text)")
            
            self.progress_store.update(session_id, "processing_slides", 10, f"Found {len(original_text_list)} slides. Starting analysis...")
            logger.info(f"✓ Converted {len(image_paths)} slides to images\n")

            # Step 2: Process slides with Gemini (with retry logic)
            logger.info(f"[STEP 2] Processing slides with Gemini...")
            slide_results = []
            failed_slides = []
            
            total_slides_count = len(original_text_list)
            
            for i in range(total_slides_count):
                slide_num = i + 1
                progress_pct = 10 + int((i / total_slides_count) * 60) # 10% to 70%
                self.progress_store.update(session_id, "processing_slides", progress_pct, f"Analyzing Slide {slide_num}/{total_slides_count}...")
                
                logger.info(f"\n--- Processing Slide {slide_num}/{total_slides_count} ---")
                
                img_path = image_paths[i] if i < len(image_paths) else None
                
                try:
                    # Use retry logic for processing
                    rewritten_content = self._process_single_slide_with_retry(
                        img_path, slide_num, tone, audience_level, 
                        slide_text_fallback=original_text_list[i]
                    )

                    # Handle speaker notes toggle
                    current_notes = ""
                    if include_speaker_notes:
                        current_notes = speaker_notes_list[i] if i < len(speaker_notes_list) else ""
                        if not isinstance(current_notes, str):
                            current_notes = str(current_notes)
                    
                    # Get original text
                    current_original_text = original_text_list[i] if i < len(original_text_list) else ""
                    
                    # Store image URL/Path for frontend
                    image_url = ""
                    if i < len(persisted_image_paths):
                        filename = Path(persisted_image_paths[i]).name
                        image_url = f"/api/images/{session_id}/{filename}"
                        logger.info(f"DEBUG: Slide {slide_num} assigned image_url: {image_url}")
                    else:
                        logger.warning(f"DEBUG: Slide {slide_num} has no persisted image (idx {i} >= {len(persisted_image_paths)})")

                    slide_results.append(
                        {
                            "slide_number": slide_num,
                            "original_content": current_original_text,
                            "rewritten_content": rewritten_content,
                            "speaker_notes": current_notes,
                            "image_url": image_url
                        }
                    )

                    logger.info(f"✓ Slide {slide_num} processed successfully")
                    
                except Exception as e:
                    logger.error(f"✗ Failed to process slide {slide_num}: {str(e)}")
                    failed_slides.append(slide_num)
                    
                    # Add placeholder for failed slide
                    slide_results.append(
                        {
                            "slide_number": slide_num,
                            "original_content": original_text_list[i] if i < len(original_text_list) else "",
                            "rewritten_content": f"[Error processing slide: {str(e)[:100]}]",
                            "speaker_notes": speaker_notes_list[i] if i < len(speaker_notes_list) else "",
                            "image_url": ""
                        }
                    )
                    continue

            # Check if too many slides failed
            if failed_slides:
                logger.warning(f"Failed to process {len(failed_slides)} slides: {failed_slides}")
                if len(failed_slides) > total_slides_count / 2:  # More than half failed
                    raise Exception(f"Too many slides failed to process: {len(failed_slides)}/{total_slides_count}")


            logger.info(f"\n✓ Processed {len(slide_results) - len(failed_slides)}/{len(slide_results)} slides successfully\n")

            # Step 3: Generate flowing narration
            logger.info("[STEP 3] Generating flowing narration...")
            try:
                narration_paragraphs = self.llm_client.generate_narration(
                    slide_results,
                    tone,
                    narration_style=narration_style,
                    dynamic_length=dynamic_length,
                    custom_instructions=custom_instructions,
                    progress_callback=lambda current, total: self.progress_store.update(
                        session_id, 
                        "generating_narration", 
                        70 + int((current / total) * 15), 
                        f"Generating narration for slide {current}/{total}..."
                    )
                )

                if len(narration_paragraphs) != len(slide_results):
                    # Adjust narration array to match slide count
                    if len(narration_paragraphs) < len(slide_results):
                        narration_paragraphs.extend([""] * (len(slide_results) - len(narration_paragraphs)))
                    else:
                        narration_paragraphs = narration_paragraphs[:len(slide_results)]
                
                logger.info(f"✓ Generated {len(narration_paragraphs)} narration paragraphs\n")
                
            except Exception as e:
                logger.error(f"Failed to generate narration: {str(e)}")
                narration_paragraphs = [""] * len(slide_results)

            # Step 4: Polish narration if enabled
            if enable_polishing:
                self.progress_store.update(session_id, "polishing", 85, "Polishing narration using AI...")
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
            else:
                logger.info("[STEP 4] Skipping narration refinement (polishing disabled)")

            # Step 5: Combine results
            self.progress_store.update(session_id, "finalizing", 95, "Finalizing results...")
            logger.info("[STEP 5] Combining results...")
            final_results = []
            for idx, slide_res in enumerate(slide_results):
                narration = narration_paragraphs[idx] if idx < len(narration_paragraphs) else ""
                
                final_results.append({
                    **slide_res,
                    "narration_paragraph": narration,
                    "processing_status": "success" if slide_res["slide_number"] not in failed_slides else "failed"
                })

            # Cleanup
            logger.info("Skipping cleanup of temporary files (DEBUG MODE)...")
            # self._cleanup_temp_files()
            
            self.progress_store.update(session_id, "complete", 100, "Processing complete!")

            return {
                "success": True,
                "total_slides": len(final_results),
                "processed_successfully": len(final_results) - len(failed_slides),
                "failed_slides": failed_slides,
                "slides": final_results
            }

        except Exception as e:
            logger.error(f"Processing failed: {str(e)}")
            self.progress_store.update(session_id, "failed", 0, str(e))
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