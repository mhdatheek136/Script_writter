from google import genai
from google.genai import types
import logging
import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from PIL import Image
from app.utils.json_utils import safe_json_loads
from app.core.prompts import (
    get_style_instructions,
    get_length_instructions,
    SLIDE_CONTENT_REWRITE_PROMPT,
    NARRATION_GENERATION_PROMPT,
    NARRATION_REFINEMENT_PROMPT,
)

logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
    
    def _extract_response_text(self, response) -> str:
        """
        Safely extract text from Gemini API response.
        Handles both simple text responses and complex multi-part responses.
        """
        # Try simple text access first
        try:
            return response.text
        except (AttributeError, ValueError, Exception) as e:
            logger.debug(f"Simple text access failed: {e}, trying parts accessor")

        # Fallback to parts accessor
        try:
            if hasattr(response, "parts") and response.parts:
                text_parts = []
                for part in response.parts:
                    if hasattr(part, "text") and part.text:
                        text_parts.append(part.text)
                if text_parts:
                    logger.debug("Successfully extracted text from response.parts")
                    return "".join(text_parts)
        except Exception as e:
            logger.warning(f"Error extracting from parts: {e}")

        # Fallback to candidates accessor
        try:
            if hasattr(response, "candidates") and response.candidates:
                for candidate in response.candidates:
                    if hasattr(candidate, "content") and candidate.content:
                        text_parts = []
                        if hasattr(candidate.content, "parts") and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "text") and part.text:
                                    text_parts.append(part.text)
                        if text_parts:
                            return "".join(text_parts)
        except Exception as e:
            logger.warning(f"Error extracting from candidates: {e}")

        # Last resort: try to get text from result object directly
        try:
            if hasattr(response, "result") and response.result:
                return self._extract_response_text(response.result)
        except Exception:
            pass

        # Final fallback: convert to string
        logger.error("Could not extract text from response using any method, using string conversion")
        return str(response)

    def process_slide_with_gemini(
        self,
        image_path: Path,
        slide_number: int,
        tone: str,
        audience_level: str,

    ) -> str:
        """
        Process a single slide image with Gemini to get rewritten content only.
        Returns rewritten content string.
        """
        try:
            logger.info(f"Processing slide {slide_number} with Gemini...")

            # Read image as PIL Image object (required by Gemini API)
            image = Image.open(image_path)

            # Build prompt
            prompt = SLIDE_CONTENT_REWRITE_PROMPT.format(
                tone=tone,
                audience_level=audience_level,
                slide_number=slide_number
            )

            # Call Gemini with image (PIL Image object)
            logger.info(f"Calling Gemini API for slide {slide_number}...")
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt, image]
            )

            # Parse JSON response - safely extract text
            response_text = self._extract_response_text(response).strip()
            logger.debug(f"Raw Gemini response for slide {slide_number}: {response_text[:200]}...")

            result = safe_json_loads(response_text)

            # Extract rewritten_content and ensure it's a string
            rewritten_content = result.get("rewritten_content", "")

            # Handle case where Gemini returns a list instead of string
            if isinstance(rewritten_content, list):
                logger.warning(
                    f"Slide {slide_number}: Gemini returned list instead of string, converting..."
                )
                rewritten_content = "\n".join(str(item) for item in rewritten_content)
            elif not isinstance(rewritten_content, str):
                logger.warning(
                    f"Slide {slide_number}: Unexpected type {type(rewritten_content)}, converting to string..."
                )
                rewritten_content = str(rewritten_content)

            logger.info(f"Successfully processed slide {slide_number}")
            return rewritten_content

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for slide {slide_number}: {str(e)}")
            logger.error(f"Response text: {response_text if 'response_text' in locals() else 'N/A'}")
            raise Exception(f"Failed to parse Gemini response as JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing slide {slide_number}: {str(e)}")
            raise Exception(f"Gemini API error: {str(e)}")

    def _compute_complexity_label(self, slide_content: str, speaker_notes: str) -> str:
        """Compute Low/Medium/High complexity based on current slide only."""
        content_length = len(slide_content.split()) if slide_content else 0
        notes_length = len(speaker_notes.split()) if speaker_notes else 0
        total = content_length + notes_length
        return "High" if total > 150 else "Medium" if total > 50 else "Low"

    def _length_target_hint(self, dynamic_length: bool, complexity: str, min_words: Optional[int] = None, max_words: Optional[int] = None) -> str:
        """Provide a per-slide word target hint without changing global behavior."""
        if not dynamic_length:
            target_min = min_words if min_words is not None else 100
            target_max = max_words if max_words is not None else 150
            logger.info(f"Using FIXED LENGTH mode: Aiming for {target_min}-{target_max} words.")
            return f"Aim for {target_min}-{target_max} words."
        
        logger.info(f"Using DYNAMIC LENGTH mode (Complexity: {complexity})")
        if complexity == "Low":
            return "Aim for 50-100 words."
        if complexity == "Medium":
            return "Aim for 100-200 words."
        return "Aim for 200-400 words, split into 2-3 paragraphs using \\n\\n if needed."

    def generate_narration(
        self,
        slide_data: List[Dict[str, str]],
        tone: str,
        narration_style: str = "Human-like",
        dynamic_length: bool = True,
        min_words: Optional[int] = None,
        max_words: Optional[int] = None,
        custom_instructions: Optional[str] = None,
        progress_callback: Optional[Any] = None,
    ) -> List[str]:
        """
        Generate narration for all slides using sequential processing.
        Returns a list of narration strings (one per slide).
        """
        try:
            total_slides = len(slide_data)
            logger.info(f"Generating narration for {total_slides} slides...")

            narrations = []

            for i, slide_info in enumerate(slide_data):
                slide_content = slide_info.get("rewritten_content", "")
                speaker_notes = slide_info.get("speaker_notes", "")

                if progress_callback:
                    try:
                        progress_callback(i + 1, total_slides)
                    except Exception as e:
                        logger.warning(f"Progress callback failed: {e}")

                try:
                    narration = self._generate_single_slide_narration(
                        slide_index=i,
                        total_slides=total_slides,
                        slide_content=slide_content,
                        speaker_notes=speaker_notes,
                        prev_narrations=narrations,
                        tone=tone,
                        narration_style=narration_style,

                        dynamic_length=dynamic_length,
                        min_words=min_words,
                        max_words=max_words,
                        custom_instructions=custom_instructions,
                    )
                except Exception as e:
                    logger.error(f"Failed to generate narration for slide {i+1}: {e}")
                    narration = slide_content  # Fallback to rewritten content

                narrations.append(narration)
                logger.info(f"Slide {i+1} narration ({len(narration.split())} words): {narration[:100]}...")

            return narrations

        except Exception as e:
            logger.error(f"Failed to generate narration: {str(e)}")
            # Fallback: return rewritten content as narration
            return [s.get("rewritten_content", "") for s in slide_data]

    def _generate_single_slide_narration(
        self,
        slide_index: int,
        total_slides: int,
        slide_content: str,
        speaker_notes: str,
        prev_narrations: List[str],
        tone: str,
        narration_style: str,

        dynamic_length: bool,
        min_words: Optional[int] = None,
        max_words: Optional[int] = None,
        custom_instructions: Optional[str] = None,
    ) -> str:
        """
        Generate narration for ONE slide only, using only the past narrations as context.
        Returns narration as plain text (single string).
        """
        slide_number = slide_index + 1

        style_instructions = get_style_instructions(narration_style)
        length_instructions = get_length_instructions(
            dynamic_length, 
            min_words if min_words is not None else 100, 
            max_words if max_words is not None else 150
        )

        complexity = self._compute_complexity_label(slide_content, speaker_notes)

        # Use all available previous narrations (up to 5)
        prev_narrations = (prev_narrations or [])[-5:]

        if prev_narrations:
            # Build context block
            context_lines = []
            for i, narration in enumerate(prev_narrations):
                context_slide_num = slide_number - len(prev_narrations) + i
                context_lines.append(f"- Slide {context_slide_num} narration: {narration}")
            prev_block = "\n".join(context_lines)
        else:
            prev_block = "[No previous narrations available]"

        needs_closing_transition = slide_number != total_slides
        closing_transition_instruction = (
            "End with a transition to the next slide only if clearly suggested by the speaker notes."
            if needs_closing_transition
            else "Do NOT add a transition to a next slide; close the narration naturally."
        )

        custom_block = ""
        if custom_instructions and custom_instructions.strip():
            custom_block = f"\nADDITIONAL CUSTOM INSTRUCTIONS:\n{custom_instructions}\n"

        prompt = NARRATION_GENERATION_PROMPT.format(
            narration_style_lower=narration_style.lower(),
            style_instructions=style_instructions,
            length_instructions=length_instructions,
            tone=tone,
            prev_block=prev_block,
            slide_number=slide_number,
            total_slides=total_slides,
            slide_content=slide_content,
            speaker_notes=speaker_notes,
            closing_transition_instruction=closing_transition_instruction,
            custom_instructions_block=custom_block
        )

        logger.info(f"Calling Gemini API for narration (slide {slide_number}/{total_slides})...")
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )

        response_text = self._extract_response_text(response).strip()
        parsed = safe_json_loads(response_text)
        narration = parsed.get("narration", "")

        if isinstance(narration, list):
            narration = "\n".join(str(x) for x in narration)
        elif not isinstance(narration, str):
            narration = str(narration)

        narration = narration.strip()
        narration = narration.replace("\\n\\n", "\n\n").replace("\\n", "\n").replace("\\t", "\t")

        return narration

    def refine_narrations_flow(self, narrations_with_indices: List[Dict[str, Any]], tone: str, style: str) -> List[str]:
        """
        Refine the flow of narrations across all slides.
        """
        try:
            logger.info("Refining narration flow across all slides...")
            
            # Prepare the input for the LLM
            slides_input = []
            for item in narrations_with_indices:
                slides_input.append({
                    "slide_number": item["slide_number"],
                    "current_narration": item["narration"]
                })
            
            prompt = NARRATION_REFINEMENT_PROMPT.format(
                tone=tone,
                style=style,
                slides_input_json=json.dumps(slides_input, indent=2)
            )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            response_text = self._extract_response_text(response)
            
            refined_data = safe_json_loads(response_text)
            
            refined_map = {}
            if isinstance(refined_data, list):
                for item in refined_data:
                    if isinstance(item, dict) and "slide_number" in item and "refined_narration" in item:
                        refined_map[item["slide_number"]] = item["refined_narration"]
            
            final_narrations = []
            for item in narrations_with_indices:
                s_num = item["slide_number"]
                if s_num in refined_map:
                    final_narrations.append(refined_map[s_num])
                else:
                    logger.warning(f"Could not find refined narration for slide {s_num}, keeping original.")
                    final_narrations.append(item["narration"])
            
            return final_narrations

        except Exception as e:
            logger.error(f"Failed to refine narration flow: {str(e)}")
            return [item["narration"] for item in narrations_with_indices]

    def rewrite_narration(
        self,
        current_narration: str,
        rewritten_content: str,
        speaker_notes: str,
        user_request: str,
        tone: str,
        style: str
    ) -> str:
        """
        Rewrite a single narration based on user's custom request.
        
        Args:
            current_narration: The current narration text
            rewritten_content: The slide's rewritten content
            speaker_notes: The slide's speaker notes
            user_request: User's specific modification request
            tone: The tone to maintain
            
        Returns:
            The rewritten narration text
        """
        try:
            from app.core.prompts import NARRATION_REWRITE_PROMPT
            
            logger.info(f"Rewriting narration with user request: '{user_request[:50]}...'")
            
            prompt = NARRATION_REWRITE_PROMPT.format(
                current_narration=current_narration,
                rewritten_content=rewritten_content,
                speaker_notes=speaker_notes,
                user_request=user_request,
                tone=tone,
                style=style
            )
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            response_text = self._extract_response_text(response).strip()
            
            parsed = safe_json_loads(response_text)
            new_narration = parsed.get("rewritten_narration", "")
            
            # Handle escape sequences
            new_narration = new_narration.replace("\\\\n\\\\n", "\\n\\n").replace("\\\\n", "\\n").replace("\\\\t", "\\t")
            
            logger.info(f"Successfully rewrote narration ({len(new_narration.split())} words)")
            return new_narration
            
        except Exception as e:
            logger.error(f"Failed to rewrite narration: {str(e)}")
            # Return original on error
            return current_narration

    def perform_global_rewrite(self, slide_data: List[Dict[str, Any]], user_request: str, tone: str, style: str) -> List[Dict[str, Any]]:
        """
        Rewrite all narrations based on a global user request.
        """
        try:
            from app.core.prompts import GLOBAL_REWRITE_PROMPT
            
            logger.info(f"Performing global rewrite with request: '{user_request[:50]}...'")
            
            # Prepare the input for the LLM
            slides_input = []
            for item in slide_data:
                slides_input.append({
                    "slide_number": item["slide_number"],
                    "current_narration": item.get("narration_paragraph", "")
                })
            
            prompt = GLOBAL_REWRITE_PROMPT.format(
                tone=tone,
                style=style,
                user_request=user_request,
                slides_input_json=json.dumps(slides_input, indent=2)
            )

            # Increase timeout for global rewrite as it processes all slides
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            response_text = self._extract_response_text(response)
            
            rewritten_data = safe_json_loads(response_text)
            
            rewritten_map = {}
            if isinstance(rewritten_data, list):
                for item in rewritten_data:
                    if isinstance(item, dict) and "slide_number" in item and "rewritten_narration" in item:
                        rewritten_map[item["slide_number"]] = item["rewritten_narration"]
            
            # Form final results
            final_slides = []
            for item in slide_data:
                s_num = item["slide_number"]
                new_narration = rewritten_map.get(s_num, item.get("narration_paragraph", ""))
                
                # Handle escape sequences
                new_narration = new_narration.replace("\\\\n\\\\n", "\\n\\n").replace("\\\\n", "\\n").replace("\\\\t", "\\t")
                
                final_slides.append({
                    **item,
                    "narration_paragraph": new_narration
                })
            
            return final_slides

        except Exception as e:
            logger.error(f"Failed to perform global rewrite: {str(e)}")
            return slide_data

