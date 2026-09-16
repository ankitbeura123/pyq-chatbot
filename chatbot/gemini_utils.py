import os
import json
import re
import time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

MODELS_TO_TRY = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]

# Free tier is ~5-15 requests/minute. 12s interval prevents hitting per-minute rate limits.
MIN_SECONDS_BETWEEN_CALLS = 12
_last_call_time = 0


def _throttle():
    global _last_call_time
    elapsed = time.time() - _last_call_time
    if elapsed < MIN_SECONDS_BETWEEN_CALLS:
        time.sleep(MIN_SECONDS_BETWEEN_CALLS - elapsed)
    _last_call_time = time.time()


def _extract_retry_delay(error, default=20):
    """Google's 429 error includes 'Please retry in Xs' or a retry_delay block. Parse it."""
    msg = str(error)
    match = re.search(r"retry_delay\s*{\s*seconds:\s*(\d+)", msg)
    if match:
        return int(match.group(1)) + 2  # small buffer
    match = re.search(r"retry in ([\d.]+)s", msg)
    if match:
        return int(float(match.group(1))) + 2
    match = re.search(r"(\d+)\s*seconds", msg)
    if match:
        return int(match.group(1)) + 2
    return default


def call_gemini_text(prompt, max_retries=10):
    """Call Gemini with free-tier model fallback + throttling + 429-aware retry/backoff."""
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
                last_error = RuntimeError("Empty response from model")
                break  # try next model
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str or "resourceexhausted" in err_str or "rate limit" in err_str:
                    wait = _extract_retry_delay(e)
                    print(f"    [rate limit] {model_name} hit quota, waiting {wait}s (attempt {attempt+1}/{max_retries})...")
                    time.sleep(wait)
                    attempt += 1
                    continue
                else:
                    # Non-rate-limit error (e.g., model deprecation or unsupported in region) — fallback to next model
                    print(f"    [fallback] {model_name} unavailable ({e}), trying next model...")
                    break

    raise RuntimeError(f"All Gemini models failed after retries: {last_error}")


def call_gemini_json(prompt, max_retries=10):
    raw = call_gemini_text(prompt, max_retries=max_retries)
    cleaned = re.sub(r"^```json\s*|^```\s*|```\s*$", "", raw.strip(), flags=re.MULTILINE).strip()

    # 1. Direct attempt
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 2. Extract outer JSON object or array if extra text surrounded it
    match = re.search(r"(\[.*\]|\{.*\})", cleaned, re.DOTALL)
    candidate = match.group(1) if match else cleaned

    try:
        return json.loads(candidate)
    except Exception:
        pass

    # 3. Handle unescaped backslashes from LaTeX (e.g. \frac, \sum, \alpha, \mathcal, \theta)
    # Double backslashes that are not followed by quotes or other backslashes
    fixed_all = re.sub(r'\\(?!["\\])', r'\\\\', candidate)
    try:
        return json.loads(fixed_all)
    except Exception:
        pass

    # 4. Standard JSON escape repair (only double invalid escapes)
    fixed = re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', r'\\\\', candidate)
    try:
        return json.loads(fixed)
    except Exception:
        pass

    # 5. Try with strict=False (allows raw newlines / unescaped control characters in strings)
    for text_variant in (fixed_all, fixed, candidate):
        try:
            return json.loads(text_variant, strict=False)
        except Exception:
            pass

    # If all recovery attempts fail, attempt final parse to raise informative JSONDecodeError
    return json.loads(cleaned)