import json
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

def extract_first_json_object(text: str) -> str:
    """
    Extract the first top-level JSON object from a string.
    This avoids failures when the model returns extra text around JSON.
    """
    text = text.strip()
    start = text.find("{")
    if start == -1:
        raise Exception("No JSON object found in response")

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(text)):
        ch = text[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        else:
            if ch == '"':
                in_string = True
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]

    raise Exception("Could not find matching closing brace for JSON object")

def clean_json_control_chars(s: str) -> str:
    """
    Remove unescaped control characters that break json.loads.
    This targets characters in U+0000..U+001F (except valid JSON escapes).
    """
    if not s:
        return s

    out = []
    for ch in s:
        code = ord(ch)
        if code < 32:
            # drop actual control chars; json requires them to be escaped (\\n, \\t, etc.)
            continue
        out.append(ch)
    return "".join(out)

def safe_json_loads(response_text: str) -> Dict:
    """
    Robust JSON parse:
    1) Strip code fences if present
    2) Try direct json.loads
    3) Extract first JSON object and try again
    4) Remove control chars and try again (both full text and extracted object)
    """
    text = (response_text or "").strip()

    # Remove markdown code blocks if present
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

    # Attempt direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting first JSON object
    try:
        candidate = extract_first_json_object(text)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # try cleaned candidate
            cleaned_candidate = clean_json_control_chars(candidate)
            return json.loads(cleaned_candidate)
    except Exception:
        pass

    # As a last resort, clean the full text and parse again
    cleaned = clean_json_control_chars(text)
    return json.loads(cleaned)
