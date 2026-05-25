#!/usr/bin/env python3
"""
Test suite for JSON repair utilities
Validates recovery from common Gemma4 JSON formatting issues
"""

from json_repair import try_parse_json, repair_json_string
import json

def test_case(name: str, malformed_json: str, should_succeed: bool = True) -> bool:
    """Test a single JSON repair case."""
    print(f"\n{'='*60}")
    print(f"Test: {name}")
    print(f"Input: {malformed_json[:100]}..." if len(malformed_json) > 100 else f"Input: {malformed_json}")
    
    try:
        result = try_parse_json(malformed_json)
        if result:
            print(f"[OK] PASS - Parsed successfully")
            print(f"  Keys: {list(result.keys())}")
            return should_succeed
        else:
            print(f"[FAIL] Returned None")
            return not should_succeed
    except Exception as e:
        print(f"[FAIL] Exception: {e}")
        return not should_succeed


# Test cases simulating real Gemma4 issues
test_results = []

# Test 1: Valid JSON (baseline)
test_results.append(test_case(
    "Valid JSON",
    '{"dream": "ML Engineer", "summary": "Learn ML", "stages": [{"id": "1", "title": "Basics"}]}'
))

# Test 2: JSON wrapped in markdown code blocks
test_results.append(test_case(
    "Markdown wrapped JSON",
    """```json
{
  "dream": "Web Developer",
  "summary": "Learn web dev",
  "stages": [{"id": "1", "title": "HTML/CSS"}]
}
```"""
))

# Test 3: Trailing commas
test_results.append(test_case(
    "Trailing commas",
    """{
  "dream": "Data Scientist",
  "summary": "Learn data science",
  "stages": [
    {"id": "1", "title": "Python",},
    {"id": "2", "title": "ML",},
  ],
}"""
))

# Test 4: Unescaped newlines in strings
test_results.append(test_case(
    "Unescaped newlines",
    """{
  "dream": "DevOps Engineer",
  "summary": "Learn DevOps
technologies",
  "stages": [{"id": "1", "title": "Docker"}]
}"""
))

# Test 5: Single quotes instead of double quotes
test_results.append(test_case(
    "Single quotes",
    """{
  'dream': 'Cybersecurity Expert',
  'summary': 'Learn security',
  'stages': [{'id': '1', 'title': 'Networking'}]
}"""
))

# Test 6: JSON with explanatory text before and after
test_results.append(test_case(
    "JSON with explanatory text",
    """Here's your roadmap in JSON format:

{
  "dream": "Cloud Architect",
  "summary": "Learn cloud",
  "stages": [{"id": "1", "title": "AWS"}]
}

Hope this helps!"""
))

# Test 7: Incomplete JSON (truncated response)
test_results.append(test_case(
    "Incomplete JSON",
    """{
  "dream": "Product Manager",
  "summary": "Learn PM",
  "stages": [
    {"id": "1", "title": "Metrics"}
  ]
}""",
    should_succeed=True
))

# Test 8: Complex nested with issues
test_results.append(test_case(
    "Complex nested with mixed issues",
    """```json
{
  "dream": "Mobile Developer",
  "summary": "Build mobile
apps with Flutter",
  "stages": [
    {
      "id": "stage-1",
      "title": "Dart Basics",
      "description": "Learn Dart
and fundamentals",
      "subjects": ["Dart", "OOP",],
    },
    {
      "id": "stage-2",
      "title": "Flutter UI",
      "subjects": ['Widgets', 'Layouts'],
    },
  ],
}
```"""
))

# Results
print(f"\n\n{'='*60}")
print("TEST SUMMARY")
print(f"{'='*60}")
passed = sum(test_results)
total = len(test_results)
print(f"Passed: {passed}/{total}")
print(f"Success Rate: {(passed/total)*100:.1f}%")

if passed == total:
    print("\n[OK] All tests passed!")
    exit(0)
else:
    print(f"\n[FAIL] {total - passed} test(s) failed")
    exit(1)
