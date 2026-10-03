import os
import json
import re
import time
import threading
import google.generativeai as genai
from dotenv import load_dotenv

_keys_lock = threading.Lock()
_current_key_idx = 0
_key_cooldowns = {}  # {api_key: cooldown_until_timestamp}


def _mask_key(key: str) -> str:
    if not key:
        return "none"
    s = key.strip()
    if len(s) <= 8:
        return s[:2] + "..."
    return s[:4] + "..." + s[-4:]


def _extract_keys_from_text(text: str) -> list[str]:
    if not text:
        return []
    s = text.strip()
    # Try parsing as JSON array
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(item).strip().strip("'\"") for item in parsed if item]
        except Exception:
            pass

    # Try matching quoted strings (e.g. "key1", 'key2')
    quoted = re.findall(r'["\']([^"\']{15,})["\']', s)
    if quoted:
        return [q.strip() for q in quoted]

    # Split on commas, semicolons, newlines, pipes
    parts = re.split(r"[,;\n|]+", s)
    results = []
    for p in parts:
        cleaned = p.strip().strip("[]()'\",")
        if cleaned:
            results.append(cleaned)
    return results


def get_all_api_keys():
    """
    Extracts all Gemini/Google API keys from .env and environment variables.
    Supports:
      - GEMINI_API_KEYS=["key1", "key2", "key3"] (JSON / Python list array)
      - GEMINI_API_KEYS="key1,key2,key3"
      - GEMINI_API_KEY="key1,key2,key3" (or single key)
      - GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...
      - Multi-line arrays across lines in .env
    """
    load_dotenv(override=True)
    raw_candidates = []

    # 1. Check known multi-key env vars
    for env_var in ["GEMINI_API_KEYS", "GOOGLE_API_KEYS", "GEMINI_API_KEY", "GOOGLE_API_KEY"]:
        val = os.getenv(env_var, "").strip()
        if val:
            raw_candidates.extend(_extract_keys_from_text(val))

    # 2. Check numbered env vars like GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
    for k, v in os.environ.items():
        if re.match(r"^(?:GEMINI|GOOGLE)_API_KEY(?:_\d+|\d+)?$", k, re.IGNORECASE):
            if v and v.strip():
                raw_candidates.extend(_extract_keys_from_text(v))

    # 3. Directly parse .env files to catch multi-line arrays or raw pasted keys
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_paths = [
        os.path.join(base_dir, ".env"),
        os.path.abspath(".env"),
    ]
    for env_path in env_paths:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # Catch multi-line array declarations like GEMINI_API_KEYS = [ ... ]
                for match in re.finditer(r'(?:GEMINI|GOOGLE)_API_KEYS?\s*=\s*(\[[^\]]*\])', content, re.DOTALL | re.IGNORECASE):
                    raw_candidates.extend(_extract_keys_from_text(match.group(1)))

                # Catch line-by-line definitions
                for line in content.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        _, val = line.split("=", 1)
                        raw_candidates.extend(_extract_keys_from_text(val))
                    else:
                        raw_candidates.extend(_extract_keys_from_text(line))
            except Exception:
                pass

    # Deduplicate while preserving order & filter out placeholders
    valid_keys = []
    seen = set()
    for k in raw_candidates:
        cleaned = k.strip().strip("[]()'\",")
        if not cleaned or "your_" in cleaned.lower() or "<" in cleaned or ">" in cleaned:
            continue
        if len(cleaned) < 15:
            continue
        if cleaned not in seen:
            seen.add(cleaned)
            valid_keys.append(cleaned)

    return valid_keys


def get_next_available_key(force_advance=False):
    """
    Selects the next available API key in round-robin fashion,
    skipping keys currently in cooldown (rate-limited).
    """
    global _current_key_idx
    keys = get_all_api_keys()
    if not keys:
        raise RuntimeError(
            "No valid GEMINI_API_KEY found in .env file. Please add your key as GEMINI_API_KEY or GEMINI_API_KEYS=key1,key2"
        )

    now = time.time()
    with _keys_lock:
        if force_advance:
            _current_key_idx = (_current_key_idx + 1) % len(keys)

        # Try to find a key starting from _current_key_idx that is not in cooldown
        for i in range(len(keys)):
            idx = (_current_key_idx + i) % len(keys)
            k = keys[idx]
            cooldown_until = _key_cooldowns.get(k, 0)
            if now >= cooldown_until:
                _current_key_idx = (idx + 1) % len(keys)
                genai.configure(api_key=k)
                return k

        # If all keys are in cooldown, pick the one with the earliest expiry
        earliest_key = min(keys, key=lambda k: _key_cooldowns.get(k, 0))
        _current_key_idx = (keys.index(earliest_key) + 1) % len(keys)
        genai.configure(api_key=earliest_key)
        return earliest_key


def mark_key_rate_limited(api_key: str, cooldown_seconds: int = 60):
    """Marks an API key as in cooldown due to quota / rate limiting."""
    with _keys_lock:
        _key_cooldowns[api_key] = time.time() + cooldown_seconds
        keys = get_all_api_keys()
        key_num = (keys.index(api_key) + 1) if api_key in keys else "?"
        total = len(keys)
        print(f"    [API Key Rotation] Key #{key_num}/{total} ({_mask_key(api_key)}) quota exceeded. Cooling down for {cooldown_seconds}s.")


def _ensure_configured():
    try:
        get_next_available_key(force_advance=False)
    except Exception:
        pass


MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
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


def _extract_retry_delay(error, default=60):
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
    """Call Gemini with active model fallback + API key rotation + throttling + 429-aware retry."""
    keys = get_all_api_keys()
    if not keys:
        raise RuntimeError("No valid GEMINI_API_KEY found in .env file.")

    last_error = None
    num_keys = len(keys)

    for model_name in MODELS_TO_TRY:
        # For each model, attempt with available keys
        for key_attempt in range(num_keys):
            _throttle()
            current_key = get_next_available_key(force_advance=(key_attempt > 0))
            genai.configure(api_key=current_key)

            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text
                last_error = RuntimeError(f"Empty response from model {model_name}")
                break  # Empty response, try next model
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if (
                    "429" in err_str
                    or "quota" in err_str
                    or "resource_exhausted" in err_str
                    or "resourceexhausted" in err_str
                    or "rate limit" in err_str
                ):
                    wait = _extract_retry_delay(e, default=60)
                    mark_key_rate_limited(current_key, cooldown_seconds=max(wait, 30))
                    if num_keys > 1 and key_attempt < num_keys - 1:
                        print(f"    [API Key Failover] {model_name} quota hit on {_mask_key(current_key)}. Switching to next API key immediately...")
                        continue  # Try next key on this model immediately
                    else:
                        print(f"    [rate limit] All {num_keys} API keys hit quota for {model_name}. Trying next fallback model...")
                        break  # All keys hit quota for this model, move to next model
                else:
                    # Non-rate-limit error (e.g. 404 model not found, invalid argument)
                    print(f"    [fallback] {model_name} failed ({e}), trying next model...")
                    break

    raise RuntimeError(f"All LLM models and API keys failed/exhausted. Last error: {last_error}")



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