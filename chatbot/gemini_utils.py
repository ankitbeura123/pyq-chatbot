import os
import json
import re
import time
import google.generativeai as genai
from dotenv import load_dotenv


def _ensure_configured():
    load_dotenv(override=True)
    api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("No GEMINI_API_KEY or GOOGLE_API_KEY found in .env file.")
    genai.configure(api_key=api_key)


MODELS_TO_TRY = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-flash-lite-latest",
    "gemma-4-31b-it",
    "gemma-4-26b-a4b-it",
    "gemini-flash-latest",
]

# Free tier is ~5-15 requests/minute. 1s interval prevents flooding.
MIN_SECONDS_BETWEEN_CALLS = 1
_last_call_time = 0


def _throttle():
    global _last_call_time
    elapsed = time.time() - _last_call_time
    if elapsed < MIN_SECONDS_BETWEEN_CALLS:
        time.sleep(MIN_SECONDS_BETWEEN_CALLS - elapsed)
    _last_call_time = time.time()


def _extract_retry_delay(error, default=5):
    """Google's 429 error includes 'Please retry in Xs' or a retry_delay block. Parse it."""
    msg = str(error)
    match = re.search(r"retry_delay\s*{\s*seconds:\s*(\d+)", msg)
    if match:
        return int(match.group(1)) + 1
    match = re.search(r"retry in ([\d.]+)s", msg)
    if match:
        return int(float(match.group(1))) + 1
    match = re.search(r"(\d+)\s*seconds", msg)
    if match:
        return int(match.group(1)) + 1
    return default


def call_gemini_text(prompt, max_retries=3):
    """Call Gemini with active model fallback + throttling + 429-aware retry/backoff."""
    _ensure_configured()
    last_error = None

    for model_name in MODELS_TO_TRY:
        attempt = 0
        while attempt < max_retries:
            _throttle()
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text
                last_error = RuntimeError(f"Empty response from model {model_name}")
                break  # try next model
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str or "resourceexhausted" in err_str or "rate limit" in err_str:
                    wait = _extract_retry_delay(e, default=5)
                    # If quota wait is large (> 10s), immediately fallback to next model
                    if wait > 10:
                        print(f"    [rate limit] {model_name} quota exceeded, trying next model fallback...")
                        break
                    print(f"    [rate limit] {model_name} hit quota, waiting {wait}s (attempt {attempt+1}/{max_retries})...")
                    time.sleep(wait)
                    attempt += 1
                    continue
                else:
                    # Non-rate-limit error (e.g. 404 model not found)
                    print(f"    [fallback] {model_name} failed ({e}), trying next model...")
                    break

    raise RuntimeError(f"All LLM models failed. Last error: {last_error}")



def _strip_json_comments_and_trailing_commas(text):
    """Safely strip JS-style comments and trailing commas from LLM-generated JSON."""
    lines = []
    in_string = False
    escape = False
    for line in text.splitlines():
        new_line = []
        i = 0
        while i < len(line):
            ch = line[i]
            if escape:
                new_line.append(ch)
                escape = False
                i += 1
                continue
            if ch == '\\' and in_string:
                escape = True
                new_line.append(ch)
                i += 1
                continue
            if ch == '"':
                in_string = not in_string
                new_line.append(ch)
                i += 1
                continue
            if not in_string and i + 1 < len(line) and line[i:i+2] == '//':
                # Comment starts, ignore rest of line
                break
            new_line.append(ch)
            i += 1
        lines.append("".join(new_line))

    cleaned = "\n".join(lines)
    # Remove trailing commas before closing brackets/braces
    cleaned = re.sub(r',\s*([\]}])', r'\1', cleaned)
    return cleaned


def call_gemini_json(prompt, max_retries=10):
    raw = call_gemini_text(prompt, max_retries=max_retries)
    cleaned = re.sub(r"^```json\s*|^```\s*|```\s*$", "", raw.strip(), flags=re.MULTILINE).strip()
    cleaned = _strip_json_comments_and_trailing_commas(cleaned)

    # 1. Direct attempt
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 2. Extract outer JSON object or array if extra text surrounded it
    match = re.search(r"(\[.*\]|\{.*\})", cleaned, re.DOTALL)
    candidate = match.group(1) if match else cleaned
    candidate = _strip_json_comments_and_trailing_commas(candidate)

    try:
        return json.loads(candidate)
    except Exception:
        pass

    # 3. Handle unescaped backslashes from LaTeX (e.g. \frac, \sum, \alpha, \mathcal, \theta, \sigma, \pi)
    # Use lambda to actually double backslashes in Python re.sub
    fixed_all = re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', lambda m: r'\\', candidate)
    try:
        return json.loads(fixed_all)
    except Exception:
        pass

    # 4. Try with strict=False (allows raw newlines / control characters in strings)
    for text_variant in (fixed_all, candidate):
        try:
            return json.loads(text_variant, strict=False)
        except Exception:
            pass

    # 5. Final fallback: double all backslashes that are not followed by quotes
    fixed_aggressive = re.sub(r'\\(?!["\\])', lambda m: r'\\', candidate)
    try:
        return json.loads(fixed_aggressive, strict=False)
    except Exception:
        pass

    return json.loads(cleaned)