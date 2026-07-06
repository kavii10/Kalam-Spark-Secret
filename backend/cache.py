"""
cache.py - Simple file-based cache for Kalam Spark roadmaps.
Avoids re-crawling + re-generating for the same dream career.
Cache TTL: 7 days (careers don't change that fast).
"""

import json
import hashlib
import time
from pathlib import Path

CACHE_DIR = Path(__file__).parent / "roadmap_cache"
CACHE_DIR.mkdir(exist_ok=True)

CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _cache_key(dream: str, year: str, branch: str) -> str:
    raw = f"{dream.strip().lower()}:{year.strip().lower()}:{branch.strip().lower()}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached(dream: str, year: str, branch: str) -> dict | None:
    """Return cached roadmap if it exists and hasn't expired."""
    key = _cache_key(dream, year, branch)
    cache_file = CACHE_DIR / f"{key}.json"

    if not cache_file.exists():
        return None

    try:
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        created_at = data.get("_cached_at", 0)

        if time.time() - created_at > CACHE_TTL_SECONDS:
            cache_file.unlink(missing_ok=True)
            print(f"[Cache] Expired cache for '{dream}'")
            return None

        print(f"[Cache] HIT for '{dream}'")
        roadmap = {k: v for k, v in data.items() if not k.startswith("_")}
        return roadmap

    except Exception as e:
        print(f"[Cache] Read error: {e}")
        return None


def save_cache(dream: str, year: str, branch: str, roadmap: dict) -> None:
    """Save a roadmap to cache with a timestamp."""
    key = _cache_key(dream, year, branch)
    cache_file = CACHE_DIR / f"{key}.json"

    try:
        data = {**roadmap, "_cached_at": time.time(), "_dream": dream}
        cache_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[Cache] Saved roadmap for '{dream}'")
    except Exception as e:
        print(f"[Cache] Write error: {e}")


def clear_cache(dream: str = None, year: str = None, branch: str = None) -> int:
    """Clear cache. If dream/year/branch given, clears that specific entry. Otherwise clears all."""
    if dream and year and branch:
        key = _cache_key(dream, year, branch)
        f = CACHE_DIR / f"{key}.json"
        if f.exists():
            f.unlink()
            return 1
        return 0
    else:
        count = 0
        for f in CACHE_DIR.glob("*.json"):
            f.unlink()
            count += 1
        return count
