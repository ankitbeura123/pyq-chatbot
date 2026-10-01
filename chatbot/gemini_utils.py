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


def preprocess_gemini_json_latex(json_str):
    """
    Carefully inspects JSON string literals and escapes backslashes
    that are part of LaTeX formulas rather than valid JSON control escapes.
    Prevents \frac from becoming \x0crac, \beta from becoming \x08eta, etc.
    """
    result = []
    in_string = False
    escape_next = False
    i = 0
    n = len(json_str)

    while i < n:
        c = json_str[i]

        if escape_next:
            result.append(c)
            escape_next = False
            i += 1
            continue

        if not in_string:
            if c == '"':
                in_string = True
            result.append(c)
            i += 1
            continue

        # Inside a JSON string literal
        if c == '"':
            in_string = False
            result.append(c)
            i += 1
            continue

        if c == '\\':
            if i + 1 < n:
                next_c = json_str[i + 1]
                if next_c in ('"', '\\', '/'):
                    # Valid JSON escape (\", \\, \/)
                    result.append('\\')
                    result.append(next_c)
                    i += 2
                    continue
                elif next_c in ('b', 'f', 'n', 'r', 't'):
                    # Check if next_c is followed by a letter, digit, or LaTeX delimiter ({, _, ^, \)
                    # e.g. \frac, \beta, \theta, \neq, \rho, \to, \tau, \tan, \begin
                    is_latex = False
                    if i + 2 < n:
                        after_next = json_str[i + 2]
                        if after_next.isalnum() or after_next in ('{', '_', '^', '\\'):
                            is_latex = True

                    if is_latex:
                        # Double the backslash so json.loads receives literal \frac, \beta, etc.
                        result.append('\\\\')
                        result.append(next_c)
                        i += 2
                        continue
                    else:
                        # Standard JSON control escape (\n, \t, etc.)
                        result.append('\\')
                        result.append(next_c)
                        i += 2
                        continue
                elif next_c == 'u' and i + 5 < n and all(ch in '0123456789abcdefABCDEF' for ch in json_str[i+2:i+6]):
                    # Valid unicode escape \uXXXX
                    result.append(json_str[i:i+6])
                    i += 6
                    continue
                else:
                    # Single backslash before any other LaTeX command / symbol (\alpha, \sum, \int, \{, \}, etc.)
                    result.append('\\\\')
                    result.append(next_c)
                    i += 2
                    continue
            else:
                result.append('\\\\')
                i += 1
                continue

        result.append(c)
        i += 1

    return "".join(result)


def clean_data_latex(obj):
    """Recursively repair any mangled control characters in decoded JSON data."""
    if isinstance(obj, dict):
        return {k: clean_data_latex(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_data_latex(item) for item in obj]
    elif isinstance(obj, str):
        s = obj
        # Repair control characters produced if unescaped JSON was parsed
        s = re.sub(r'\x0c([a-zA-Z]+)', r'\\f\1', s)  # \x0crac -> \frac
        s = re.sub(r'\x08([a-zA-Z]+)', r'\\b\1', s)  # \x08eta -> \beta, \x08egin -> \begin
        s = re.sub(r'\t(heta|au|imes|o|an|ext|ilde|riangle|op)', r'\\t\1', s)
        s = re.sub(r'\n(eq|abla|u|ot|atural)', r'\\n\1', s)
        s = re.sub(r'\r(ho|ight|angle|rightarrow)', r'\\r\1', s)
        s = s.replace('\x0c', '\\f')
        s = s.replace('\x08', '\\b')
        s = s.replace('\x0b', '\\v')
        # Repair un-backslashed bare 'rac{' -> '\frac{'
        s = re.sub(r'(?<!\\)\brac\{', r'\\frac{', s)
        return s
    return obj


def call_gemini_json(prompt, max_retries=10):
    raw = call_gemini_text(prompt, max_retries=max_retries)
    cleaned = re.sub(r"^```json\s*|^```\s*|```\s*$", "", raw.strip(), flags=re.MULTILINE).strip()
    cleaned = _strip_json_comments_and_trailing_commas(cleaned)

    # Preprocess candidate text with LaTeX-aware JSON string sanitizer
    match = re.search(r"(\[.*\]|\{.*\})", cleaned, re.DOTALL)
    candidate = match.group(1) if match else cleaned
    candidate = _strip_json_comments_and_trailing_commas(candidate)

    # 1. LaTeX-sanitized parse attempt
    try:
        latex_preprocessed = preprocess_gemini_json_latex(candidate)
        parsed = json.loads(latex_preprocessed)
        return clean_data_latex(parsed)
    except Exception:
        pass

    # 2. Direct attempt on candidate
    try:
        parsed = json.loads(candidate)
        return clean_data_latex(parsed)
    except Exception:
        pass

    # 3. Handle unescaped backslashes with regex fallback
    fixed_all = re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', lambda m: r'\\', candidate)
    try:
        parsed = json.loads(fixed_all)
        return clean_data_latex(parsed)
    except Exception:
        pass

    # 4. Try with strict=False
    for text_variant in (latex_preprocessed if 'latex_preprocessed' in locals() else candidate, fixed_all, candidate):
        try:
            parsed = json.loads(text_variant, strict=False)
            return clean_data_latex(parsed)
        except Exception:
            pass

    # 5. Final fallback
    fixed_aggressive = re.sub(r'\\(?!["\\])', lambda m: r'\\', candidate)
    try:
        parsed = json.loads(fixed_aggressive, strict=False)
        return clean_data_latex(parsed)
    except Exception:
        pass

    parsed = json.loads(cleaned)
    return clean_data_latex(parsed)