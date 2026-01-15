
def get_style_instructions(narration_style: str) -> str:
    """Get style-specific instructions based on narration style."""
    styles = {
        "Human-like": """**Narration Style: Human-like**
Write as if you're speaking naturally to an audience:
- Use conversational transitions
- Add natural connectives between slides
- Reference specific points
- Explain rather than just repeat: Don't read bullet points verbatim, explain their meaning
- Use natural pauses indicated by paragraph breaks for longer content
- Make it sound like you're genuinely reading and explaining the slides""",
        "Formal": """**Narration Style: Formal**
Write in a formal, structured manner:
- Use formal transitions
- Maintain professional language throughout
- Avoid contractions and casual expressions
- Use structured transitions
- Present information systematically and authoritatively
- Keep transitions professional and clear""",
        "Concise": """**Narration Style: Concise**
Write brief, to-the-point narration:
- Get straight to the point, avoid unnecessary words
- Use direct transitions
- Focus on key points only
- Keep sentences short and clear
- Minimize filler words and phrases
- Be efficient with transitions between slides""",
        "Storytelling": """**Narration Style: Storytelling**
Write as a narrative that tells a story:
- Create a narrative arc across slides
- Use storytelling transitions
- Build connections between slides like chapters in a story
- Use descriptive language to paint a picture
- Create anticipation
- Make the presentation feel like a cohesive narrative""",
        "Conversational": """**Narration Style: Conversational**
Write in a friendly, approachable conversational style:
- Use casual, friendly transitions
- Include rhetorical questions (Do not overuse rhetorical questions)
- Use everyday language and relatable examples
- Create a dialogue feel
- Make transitions feel like natural conversation flow""",
        "Professional": """**Narration Style: Professional**
Write in a polished, business-appropriate style:
- Use professional transitions
- Maintain a balanced, confident tone
- Use clear, structured language
- Include appropriate business terminology
- Create smooth, logical transitions
- Present information with authority and clarity""",
    }
    return styles.get(narration_style, styles["Human-like"])


def get_length_instructions(dynamic_length: bool) -> str:
    """Get length-specific instructions."""
    if dynamic_length:
        return """**Dynamic Length**: Adjust the narration length based on slide content complexity.
- You are responsible for determining the current slide's complexity before writing the narration based on speaker notes and rewritten slide content.
- Simple slides (low complexity): 50-100 words, concise and clear
- Medium complexity slides: 100-150 words, with added explanation
- Complex slides (high complexity): 150-200 words, structured into multiple paragraphs if needed
- Use the Content Complexity indicator to guide narration length
- For longer narrations, only when necessary use 200-400 words), split into 2-3 paragraphs using "\\n\\n" (double newline)
- Never exceed 400 words under any circumstances
"""
    else:
        return """**Fixed Length**: Keep narration consistent across slides:
- Aim for 100-150 words per slide
- Maintain similar length for all slides regardless of content complexity
- Break into paragraphs only if exceeding 200 words
- Use "\\n\\n" (double newline) for paragraph breaks when needed"""


SLIDE_CONTENT_REWRITE_PROMPT = """You are an expert presentation script writer. Analyze this slide image and create a clear, engaging narration script that explains the content on the slide.

- Make it structured, clear, and concise
- Explain the slide content meaningfully.
- Focus on explaining things that contain text such as charts, tables, lists, etc. 
- Only describe those that are directly useful and relevant to the main information. Ignore images, icons, or visuals used solely for aesthetics (Example: a company logo, a chart with no data, a company related picture, etc.)
- Maintain the key information and meaning
- DO NOT mention the slide number in your response (it's provided only for context)
- Tone: {tone}
- Audience: {audience_level}

CRITICAL JSON RESPONSE REQUIREMENTS:
- Return your response as a JSON object with exactly this structure:
{{
    "rewritten_content": "narration script explaining slide content here"
}}

- The "rewritten_content" value must be plain text only - NO markdown formatting, NO markdown syntax (no **, *, _, #, [], etc.), NO special formatting characters
- IMPORTANT: Do NOT use double quotes (") inside the rewritten_content string - use single quotes (') if you need to quote something, or rephrase to avoid quotes entirely
- Escape any special JSON characters properly
- Only return valid JSON, no markdown formatting or additional text outside the JSON object"""


NARRATION_GENERATION_PROMPT = """You are a professional presenter creating a {narration_style_lower} narration script.

{style_instructions}

{length_instructions}

Tone: Maintain a {tone} tone throughout.

IMPORTANT CONTEXT RULES:
- You may ONLY use the past narrations provided below as cross-slide context.
- Do NOT invent, reference, or imply any other slides beyond what is provided.
- Generally avoid repeating the same phrases, sentence structures, or opening flows from previous narrations.
- Reuse wording from past narrations only when it is necessary for clarity or continuity, and do not overuse it.
- DO NOT mention slide numbers in your narration (e.g., don't say "On slide 3" or "This slide shows"). The slide number is provided only for your reference to maintain proper order.

Past narrations (most recent last):
{prev_block}

Current slide to narrate:
- Rewritten Content (This is the explantion of the content of the current slide):
{slide_content}
- Speaker Notes:
{speaker_notes}

Structure requirements for THIS slide:
- Start in a way that fits the context, but vary the opening so it does not feel repetitive.
- Use a transition from previous narrations only when it adds value; avoid forced connectors.
- Explain the slide content meaningfully (do not read or restate bullets verbatim).
- Incorporate relevant speaker notes naturally, only when they add value and context.
- {closing_transition_instruction}

The following custom instructions must be followed if provided:
{custom_instructions_block}

Return your response as a JSON object with exactly this key:
{{
  "narration": "plain text narration here"
}}

CRITICAL: 
- Only return valid JSON, no markdown, no extra text. 
- The narration must be plain text only 
- NO markdown formatting, NO markdown syntax (no **, *, _, #, [], (), etc.), NO code blocks. 
- If you need paragraph breaks, represent them using the two-character sequence \\n\\n (backslash-n-backslash-n) inside the JSON string. 
- Do NOT include literal newlines or literal tabs inside the JSON string value (they must be escaped as \\n and \\t)."""


NARRATION_REFINEMENT_PROMPT = """
You are an expert presentation speech writer. 
I have a list of narrations for a presentation, one for each slide. 
The current narrations might have awkward phrasing or lack smooth transitions between slides.

Your task is to REWRITE the narrations to improve the flow, coherence, and "speakability".

CRITICAL RULES:
1. Keep the same TONE: {tone}
2. Maintain the STYLE: {style}.
3. DO NOT change the core meaning or content. Just smooth out the wording.
4. Ensure logical transitions between slides where appropriate.
5. formatting should be natural speech.
6. RETURN DATA MUST BE A JSON ARRAY of objects.

Input Data:
{slides_input_json}

Output Format (JSON ONLY):
[
    {{
        "slide_number": 1,
        "refined_narration": "..."
    }},
    ...
]
"""


NARRATION_REWRITE_PROMPT = """You are an expert narration rewriter helping to refine presentation scripts.

You have been given:
- The current narration for a slide
- The rewritten content (explanation of slide content)
- Speaker notes (if any)
- The user's specific request for how to modify the narration

Your task is to rewrite the narration according to the user's request while maintaining:
- The core information from the rewritten content and speaker notes
- The specified tone: {tone}
- The specified style: {style}
- Natural, speakable language
- Appropriate length (unless user requests otherwise)

Context:
- Rewritten Content: {rewritten_content}
- Speaker Notes: {speaker_notes}
- Current Narration: {current_narration}
- User Request: {user_request}

Instructions:
- Carefully apply the user's requested changes
- Maintain the factual information unless user asks to change it
- Keep it natural and conversational
- DO NOT mention slide numbers
- If the user's request is unclear, do your best interpretation

Return your response as a JSON object:
{{
  "rewritten_narration": "the new narration text here"
}}

CRITICAL:
- Only return valid JSON, no markdown, no extra text
- The narration must be plain text only
- NO markdown formatting (no **, *, _, #, [], (), etc.)
- Use \\n\\n for paragraph breaks inside the JSON string
- Do NOT include literal newlines in the JSON
"""


GLOBAL_REWRITE_PROMPT = """
You are an expert presentation script writer. 
I have a list of narrations for a presentation, one for each slide. 
The user wants to completely REWRITE all these narrations based on a new instruction.

CRITICAL RULES:
1. Follow the USER REQUEST strictly for the rewrite.
2. Maintain the same slide order.
3. Maintain the TONE: {tone} unless the user explicitly asks to change it.
4. Maintain the STYLE: {style} unless the user explicitly asks to change it.
5. Keep the rewritten narration focused on the same core points as the current one, but change the delivery/style according to the user request.
6. RETURN DATA MUST BE A JSON ARRAY of objects.

USER NEW REQUEST:
{user_request}

Input Data:
{slides_input_json}

Output Format (JSON ONLY):
[
    {{
        "slide_number": 1,
        "rewritten_narration": "..."
    }},
    ...
]
"""
