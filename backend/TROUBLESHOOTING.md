# Troubleshooting Guide: Gemma 4 JSON Error

## Error: "Error generating roadmap: LLM returned invalid JSON. Please try again."

### What This Error Means
The Gemma 4 API returned a response that couldn't be parsed as valid JSON, even after automatic repair attempts.

### Quick Troubleshooting

#### 1. **Check Backend Logs**
When the error occurs, check the backend console for detailed logs with `[Roadmap]` and `[JSON]` prefixes:

```
[Roadmap] Starting generation for: Data Scientist | College Student | Engineering
[Roadmap] Prompt size: 2048 chars | Context: 5000 chars
[Roadmap] Calling LLM with max_tokens=3500, json_mode=True...
[Roadmap] LLM response received: 1856 chars
[Roadmap] Parsing JSON response...
[JSON] [OK] Parsed using: Repair and parse
[Roadmap] [OK] Successfully generated roadmap with 4 stages
```

Look for:
- `[JSON] [OK]` = Success! The issue is already resolved
- `[JSON] [-]` = Strategy failed, trying next one
- `[JSON] [XX]` = All strategies exhausted - this is the problem

#### 2. **Common Causes**

| Symptom | Cause | Solution |
|---------|-------|----------|
| Works sometimes, fails randomly | API rate limiting or timeout | Retry the request |
| Always fails on specific career path | Career name causes API issues | Try simpler career name or rephrase |
| Fails with large branch names | Context too long for API | Use shorter branch description |
| Fails immediately every time | API key misconfigured | Check `.env` GEMINI_API_KEY and OPENROUTER_API_KEY |
| Ollama used but fails | Ollama returned malformed JSON | Restart Ollama: `ollama serve` |

#### 3. **Enable Debug Mode**

Edit `backend/llm_service.py`, in `_parse_roadmap_json()` function, change:
```python
print(f"[JSON] [XX] All strategies exhausted...")
```

Add this after to save the response:
```python
# Save problematic response for analysis
with open('debug_json_response.txt', 'w', encoding='utf-8') as f:
    f.write(raw)
print("[DEBUG] Response saved to debug_json_response.txt")
```

Then check the saved response file to understand what the API returned.

#### 4. **Test Each Provider**

Check which provider is being used and whether it's working:

```bash
# Test OpenRouter (if OPENROUTER_API_KEY is set)
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemma-4-31b-it:free","messages":[{"role":"user","content":"Return JSON: {\"test\":\"value\"}"}]}'

# Test Google AI Studio (if GEMINI_API_KEY is set)
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Return JSON: {\"test\":\"value\"}"}]}]}?key=YOUR_KEY'

# Test Ollama locally
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma4:e4b","prompt":"Return JSON: {\"test\":\"value\"}","stream":false,"format":"json"}'
```

#### 5. **Verify JSON Repair Works**

Test the JSON repair utility directly:

```bash
cd backend
python -c "
from json_repair import try_parse_json

# Test with problematic JSON
test = '''
\`\`\`json
{
  \"dream\": \"Data Scientist\",
  \"summary\": \"Learn data science
techniques\",
  \"stages\": [{\"id\": \"1\", \"title\": \"Basics\",}]
}
\`\`\`
'''

result = try_parse_json(test)
if result:
    print('SUCCESS: JSON parsed correctly')
    print(f'Keys: {list(result.keys())}')
else:
    print('FAILED: Could not parse JSON')
"
```

### Advanced Debugging

#### Capture Raw Response
Modify `llm_service.py` in the `_parse_roadmap_json()` function:

```python
print(f"[DEBUG] Raw response (first 500 chars):\n{raw[:500]}")
print(f"[DEBUG] Repaired response:\n{repair_json_string(raw)[:500]}")
```

#### Check API Response Status
In `llm_service.py`, after each API call:

```python
print(f"[DEBUG] API Response Status: {resp.status_code}")
print(f"[DEBUG] Response Headers: {resp.headers}")
print(f"[DEBUG] Response Text: {resp.text[:500]}")
```

### When to Report an Issue

If after trying the above steps the error persists:

1. **Capture the debug output** (especially the raw JSON response)
2. **Check which provider** is being used (OpenRouter, Gemini, or Ollama)
3. **Note the error pattern** (always fails, fails on specific careers, random failures)
4. **Provide logs** showing `[JSON]` parsing attempts
5. **Include your prompts** (dream career, education level, branch) that trigger the error

### Permanent Fix Options

If the error happens frequently:

1. **Switch providers**:
   - If using Google AI Studio → try OpenRouter instead
   - If using OpenRouter → try Ollama locally (most reliable)

2. **Increase token limits**:
   In `llm_service.py`, increase `max_tokens` in `generate_roadmap()`:
   ```python
   raw_response = await _call_llm_chat(..., max_tokens=4500, ...)  # Was 3500
   ```

3. **Use stricter prompting**:
   The prompt already includes strict JSON instructions. If issues persist, you can make the system prompt even more explicit about the required format.

4. **Fallback to cached roadmap**:
   The system caches successful roadmaps. Requesting the same career again usually works.

---

**Need Help?** Check the server logs first - they're the best source of truth about what's happening!
