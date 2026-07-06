"""
JSON repair utilities — handles common Gemma4 response formatting issues
Pragmatic approach focused on real-world Gemma4 output problems
"""
import re
import json


def repair_json_string(raw: str) -> str:
    """
    Pragmatic JSON repair focusing on most common Gemma4 issues:
    1. Markdown code block wrapping
    2. Trailing commas
    3. Unescaped newlines in strings
    4. Missing or incomplete JSON structures
    """
    text = raw.strip()
    
    # 1. Extract from markdown code blocks (most common)
    for fence in [('```json', '```'), ('```', '```')]:
        if fence[0] in text:
            match = re.search(re.escape(fence[0]) + r'\s*(.*?)\s*' + re.escape(fence[1]), text, re.DOTALL | re.IGNORECASE)
            if match:
                text = match.group(1).strip()
                break
    
    # 2. Remove any leading/trailing text before { and after }
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        text = match.group(0)
    
    text = text.strip()
    
    # 3. Fix unescaped newlines in string values (critical for multiline descriptions)
    # Process line by line to handle embedded newlines
    lines = text.split('\n')
    result_lines = []
    in_string = False
    string_char = None
    current_line = ""
    
    for line in lines:
        for char in line:
            if char in ('"', "'") and (not current_line or current_line[-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                    string_char = None
            current_line += char
        
        if in_string:
            # Append to the current string (don't end the line)
            current_line += '\\n'  # Add escaped newline for the actual newline we're crossing
        else:
            result_lines.append(current_line)
            current_line = ""
    
    if current_line:
        result_lines.append(current_line)
    
    text = '\n'.join(result_lines)
    
    # 4. Remove trailing commas (pragmatic: just remove comma before } or ])
    text = re.sub(r',\s*([}\]])', r'\1', text)
    text = re.sub(r',\s*([}\]])', r'\1', text)  # Second pass for nested
    
    # 5. Basic single-quote to double-quote conversion for property names
    # Only convert: 'propertyname': pattern
    text = re.sub(r"'([a-zA-Z_][a-zA-Z0-9_]*)'(\s*:)", r'"\1"\2', text)
    
    # 6. Ensure we have valid outer braces
    if not text.startswith('{'):
        idx = text.find('{')
        if idx >= 0:
            text = text[idx:]
    
    if not text.endswith('}'):
        idx = text.rfind('}')
        if idx >= 0:
            text = text[:idx + 1]
    
    return text


def try_parse_json(raw: str) -> dict | None:
    """
    Try to parse JSON with multiple strategies.
    Returns dict on success, None on failure.
    """
    if not raw or len(raw.strip()) < 10:
        return None
    
    original = raw
    strategies = [
        ("Direct parse", lambda t: json.loads(t)),
        ("Repair and parse", lambda t: json.loads(repair_json_string(t))),
        ("Extract and repair", lambda t: json.loads(repair_json_string(t.strip()))),
    ]
    
    for strategy_name, strategy_func in strategies:
        try:
            result = strategy_func(raw)
            if isinstance(result, dict):
                print(f"[JSON] [OK] Parsed using: {strategy_name}")
                return result
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            print(f"[JSON] [-] {strategy_name} failed: {str(e)[:40]}")
            continue
    
    # Last resort: try each strategy with the repaired version
    repaired = repair_json_string(original)
    try:
        result = json.loads(repaired)
        if isinstance(result, dict):
            print(f"[JSON] [OK] Parsed after full repair")
            return result
    except Exception as e:
        print(f"[JSON] [-] Repair parse failed: {str(e)[:40]}")
    
    print(f"[JSON] [XX] All strategies exhausted. Raw (first 150): {raw[:150]}")
    return None


