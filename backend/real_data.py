"""
real_data.py — Real-world data fetchers for Kalam Spark.
Replaces all LLM-hallucinated opportunity and news data with
live data from real APIs and scrapers.

Sources:
  • Adzuna API          — Real Indian job listings (free, 250 req/day)
  • Devfolio GraphQL    — Real hackathons (free, no key)
  • Internshala scrape  — Real internship listings (free, no key)
  • HackerNews Algolia  — Real tech/career news (free, no key)
  • Dev.to API          — Real developer articles (free, no key)
"""

import asyncio
import os
import re
import time
import json
from typing import Optional

import httpx
from bs4 import BeautifulSoup

# ─── Adzuna credentials ─── load from env vars ONLY (never hardcode) ─────────
# Set these in backend/.env for local dev, and in Render Environment for production.
# Register at: https://developer.adzuna.com/ (free, 250 req/day)
ADZUNA_APP_ID  = os.getenv("ADZUNA_APP_ID",  "")  # e.g. "61e33034"
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")  # your application key

# ─── Shared HTTP client (reuse connections) ──────────────────────────────────
_client: Optional[httpx.AsyncClient] = None

def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=20.0,
            headers={"User-Agent": "KalamSpark/1.0 (educational app; kavii10@github)"},
            follow_redirects=True,
        )
    return _client


# ─── 6-hour in-memory cache (keyed by dream) ────────────────────────────────
_cache: dict[str, tuple[float, list]] = {}
_news_cache: dict[str, tuple[float, list]] = {}
CACHE_TTL = 6 * 3600  # 6 hours


def _cache_get(store: dict, key: str) -> Optional[list]:
    if key in store:
        ts, data = store[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _cache_set(store: dict, key: str, data: list) -> None:
    store[key] = (time.time(), data)


# ══════════════════════════════════════════════════════════════════════════════
# 1. JOBS — Adzuna India API
# ══════════════════════════════════════════════════════════════════════════════

def _dream_to_search_term(dream: str) -> str:
    """
    Map a career dream to the best Adzuna search keyword.
    Adzuna is a job board — 'IAS Officer' returns noise; 'government officer' returns real listings.
    """
    d = dream.lower()
    if any(k in d for k in ["ias", "upsc", "civil servant", "civil service", "ips", "collector", "magistrate"]):
        return "government officer"
    if any(k in d for k in ["doctor", "mbbs", "physician", "surgeon"]):
        return "doctor physician"
    if any(k in d for k in ["lawyer", "advocate", "legal"]):
        return "lawyer legal counsel"
    if any(k in d for k in ["teacher", "professor", "lecturer"]):
        return "teacher educator"
    if any(k in d for k in ["architect"]):
        return "architect design"
    if any(k in d for k in ["accountant", "ca ", "chartered"]):
        return "chartered accountant finance"
    # For tech/other dreams use the dream as-is (trimmed to 3 words max)
    words = dream.strip().split()
    return " ".join(words[:3])


def _skills_for_dream(dream: str) -> list[str]:
    """
    Generates relevant skill tags dynamically from the dream career title
    without using any predefined career lists or templates.
    """
    import re
    words = [w.strip() for w in re.split(r"[^a-zA-Z0-9]+", dream) if w.strip()]
    stop_words = {"a", "an", "the", "to", "of", "for", "in", "and", "or", "with", "specialist", "expert", "officer", "practitioner", "professional", "career", "dream", "job"}
    keywords = [w.capitalize() for w in words if w.lower() not in stop_words and len(w) > 2]
    
    if not keywords:
        return ["Core Skills", "Communication", "Practical Application", "Problem Solving"]
    
    tags = []
    if len(keywords) >= 1:
        tags.append(keywords[0] + " Fundamentals")
    if len(keywords) >= 2:
        tags.append(keywords[1] + " Methodologies")
    elif len(keywords) == 1:
        tags.append(keywords[0] + " Practice")
    
    tags.append("Domain Knowledge")
    tags.append("Analytical Thinking")
    return tags


async def fetch_adzuna_jobs(dream: str, max_results: int = 5) -> list[dict]:
    """
    Fetch real Indian job listings from Adzuna.
    Free tier: 250 req/day. Register at developer.adzuna.com.
    Credentials loaded from ADZUNA_APP_ID + ADZUNA_APP_KEY env vars."""
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        print("[Adzuna] Credentials missing — skipping")
        return []
    try:
        search_term = _dream_to_search_term(dream)  # smart mapping, not raw dream string
        skills = _skills_for_dream(dream)
        params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "results_per_page": max_results,
            "what": search_term,
            "where": "India",
            "content-type": "application/json",
        }
        resp = await _get_client().get(
            "https://api.adzuna.com/v1/api/jobs/in/search/1",
            params=params,
        )
        if resp.status_code != 200:
            print(f"[Adzuna] HTTP {resp.status_code}: {resp.text[:200]}")
            return []

        items = resp.json().get("results", [])
        jobs = []
        for item in items[:max_results]:
            title    = item.get("title", f"{dream} Role")
            company  = item.get("company", {}).get("display_name", "Hiring Company")
            location = item.get("location", {}).get("display_name", "India")
            apply_url = item.get("redirect_url") or f"https://www.adzuna.in/search?q={search_term.replace(' ', '+')}"

            # Parse salary
            sal_min = item.get("salary_min")
            sal_max = item.get("salary_max")
            if sal_min and sal_max:
                salary = f"₹{int(sal_min):,} – ₹{int(sal_max):,}"
            elif sal_min:
                salary = f"₹{int(sal_min):,}+"
            else:
                salary = "Competitive"

            # Description snippet
            desc = item.get("description", "")
            desc_clean = re.sub(r"<[^>]+>", "", desc).strip()[:200]

            jobs.append({
                "type":            "Job",
                "title":           title,
                "company":         company,
                "location":        location,
                "salary":          salary,
                "description":     desc_clean,
                "requiredSkills":  skills,          # ← frontend needs this field
                "applyUrl":        apply_url,        # ← real Adzuna redirect URL
                "searchUrl":       apply_url,        # ← alias so both field names work
                "platform":        "adzuna",
                "source":          "Adzuna",
                "matchPercentage": 85,
                "actionText":      "Apply Now",
                "isReal":          True,
            })
        print(f"[Adzuna] ✓ {len(jobs)} jobs for '{dream}' (searched: '{search_term}')")
        return jobs
    except Exception as e:
        print(f"[Adzuna] Failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# 2. HACKATHONS — Devfolio Public GraphQL
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_devfolio_hackathons(dream: str, max_results: int = 4) -> list[dict]:
    """
    Fetch real hackathons from Devfolio's public GraphQL API (no key needed).
    """
    try:
        # Devfolio is tech-centric. If it's a non-tech dream, search for 'open' or 'innovation'
        is_tech = any(k in dream.lower() for k in ["engineer", "developer", "software", "data", "ai", "ml", "tech", "coding", "programming"])
        
        if is_tech:
            query_term = dream.split()[0]
        else:
            # For non-tech, search for broader innovation/student challenges
            query_term = "innovation"
            
        payload = {
            "query": """
                query SearchHackathons($q: String!) {
                  hackathons(
                    where: {
                      _or: [
                        { name: { _ilike: $q } },
                        { tagline: { _ilike: $q } }
                      ]
                      status: { _in: ["open", "upcoming"] }
                    }
                    limit: 6
                    order_by: { starts_at: desc }
                  ) {
                    name
                    tagline
                    prize_amount
                    starts_at
                    ends_at
                    slug
                  }
                }
            """,
            "variables": {"q": f"%{query_term}%"},
        }
        resp = await _get_client().post(
            "https://api.devfolio.co/api/graphql",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        data = resp.json() if resp.status_code == 200 else {}
        hackathons_raw = data.get("data", {}).get("hackathons", [])

        # Fallback: if no specific results, fetch recent open hackathons
        if not hackathons_raw:
            payload["query"] = """
                query RecentHackathons {
                  hackathons(
                    where: { status: { _in: ["open", "upcoming"] } }
                    limit: 6
                    order_by: { starts_at: desc }
                  ) {
                    name tagline prize_amount starts_at ends_at slug
                  }
                }
            """
            del payload["variables"]
            resp2 = await _get_client().post(
                "https://api.devfolio.co/api/graphql",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            data2 = resp2.json() if resp2.status_code == 200 else {}
            hackathons_raw = data2.get("data", {}).get("hackathons", [])

        results = []
        for h in hackathons_raw[:max_results]:
            prize = f"₹{int(h['prize_amount']):,}" if h.get("prize_amount") else "Prizes Announced"
            apply_url = f"https://devfolio.co/hackathons/{h.get('slug', '')}"
            results.append({
                "type":            "Hackathon",
                "title":           h.get("name", "Hackathon"),
                "company":         "Devfolio",
                "location":        "Online",
                "description":     h.get("tagline", "Build something amazing"),
                "prize":           prize,
                "requiredSkills":  ["Teamwork", "Innovation", "Problem Solving", "Presentation"],
                "applyUrl":        apply_url,
                "searchUrl":       apply_url,
                "platform":        "devfolio",
                "source":          "Devfolio",
                "matchPercentage": 88,
                "actionText":      "Register on Devfolio",
                "isReal":          True,
            })
        print(f"[Devfolio] ✓ {len(results)} hackathons")
        return results
    except Exception as e:
        print(f"[Devfolio] Failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# 3. INTERNSHIPS — Internshala Scraper
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_internshala_internships(dream: str, max_results: int = 4) -> list[dict]:
    """
    Scrape Internshala's public search page for real internship listings.
    No API key needed — uses their public HTML search results.
    """
    try:
        # Build Internshala search URL using the smart search term
        search_term = _dream_to_search_term(dream)
        slug = re.sub(r"[^a-z0-9\s-]", "", search_term.lower()).strip()
        slug = re.sub(r"\s+", "-", slug)
        search_url = f"https://internshala.com/internships/{slug}-internship"

        resp = await _get_client().get(
            search_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-IN,en;q=0.9",
            },
        )

        if resp.status_code != 200:
            # Fallback: use generic search
            search_url = "https://internshala.com/internships/"
            resp = await _get_client().get(search_url)

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select(".individual_internship")[:max_results]

        results = []
        for card in cards:
            title_el   = card.select_one(".profile") or card.select_one("h3")
            company_el = card.select_one(".company_name") or card.select_one(".company-name")
            loc_el     = card.select_one(".locations span") or card.select_one(".location_link")
            stip_el    = card.select_one(".stipend") or card.select_one(".stipend_container")
            dur_el     = card.select_one(".duration-container") or card.select_one(".internship_other_details_container")
            link_tag   = card.find("a", href=True)

            title   = title_el.get_text(strip=True)   if title_el   else f"{dream} Intern"
            company = company_el.get_text(strip=True)  if company_el else "Company"
            loc     = loc_el.get_text(strip=True)      if loc_el     else "Remote"
            stipend = stip_el.get_text(strip=True)     if stip_el    else "Stipend offered"
            dur     = dur_el.get_text(strip=True)[:50] if dur_el     else ""
            apply   = (f"https://internshala.com{link_tag['href']}"
                       if link_tag and link_tag.get("href", "").startswith("/") else search_url)

            if not title or len(title) < 3:
                continue

            skills = _skills_for_dream(dream)
            results.append({
                "type":            "Internship",
                "title":           title,
                "company":         company,
                "location":        loc,
                "stipend":         stipend,
                "duration":        dur,
                "requiredSkills":  skills,
                "applyUrl":        apply,
                "searchUrl":       apply,
                "platform":        "internshala",
                "source":          "Internshala",
                "matchPercentage": 82,
                "actionText":      "Apply on Internshala",
                "isReal":          True,
            })

        print(f"[Internshala] ✓ {len(results)} internships for '{dream}'")
        return results
    except Exception as e:
        print(f"[Internshala] Failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# 4. NEWS — HackerNews Algolia (free, no key)
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_hackernews(topic: str, count: int = 5) -> list[dict]:
    """
    Fetch real tech/career stories from HackerNews via the Algolia API.
    100% free, no API key, always live.
    """
    try:
        resp = await _get_client().get(
            "https://hn.algolia.com/api/v1/search",
            params={
                "query": topic,
                "tags": "story",
                "hitsPerPage": count,
                "minPoints": 5,  # only popular stories
            },
        )
        hits = resp.json().get("hits", []) if resp.status_code == 200 else []
        articles = []
        for h in hits:
            url = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID', '')}"
            title = h.get("title", "").strip()
            if not title or not url:
                continue
            articles.append({
                "id":          f"hn-{h.get('objectID', '')}",
                "title":       title,
                "summary":     f"HackerNews · {h.get('points', 0)} points · {h.get('num_comments', 0)} comments",
                "link":        url,
                "source":      "HackerNews",
                "publishedAt": h.get("created_at", ""),
                "imageUrl":    None,
                "isReal":      True,
            })
        print(f"[HackerNews] ✓ {len(articles)} stories for '{topic}'")
        return articles
    except Exception as e:
        print(f"[HackerNews] Failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# 5. NEWS — Dev.to API (free, no key)
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_devto(topic: str, count: int = 5) -> list[dict]:
    """
    Fetch real developer articles from Dev.to's free API.
    No key needed — public API.
    """
    try:
        # Sanitize topic into a simple tag
        tag = re.sub(r"[^a-z0-9]", "", topic.lower().split()[0])[:20]
        resp = await _get_client().get(
            "https://dev.to/api/articles",
            params={"tag": tag, "per_page": count, "top": "7"},
        )
        articles_raw = resp.json() if resp.status_code == 200 else []
        articles = []
        for a in articles_raw:
            if not isinstance(a, dict):
                continue
            title = a.get("title", "").strip()
            url   = a.get("url", "").strip()
            if not title or not url:
                continue
            articles.append({
                "id":          f"devto-{a.get('id', '')}",
                "title":       title,
                "summary":     a.get("description", "")[:200],
                "link":        url,
                "source":      "Dev.to",
                "publishedAt": a.get("published_at", ""),
                "imageUrl":    a.get("cover_image"),
                "isReal":      True,
            })
        print(f"[Dev.to] ✓ {len(articles)} articles for '{topic}'")
        return articles
    except Exception as e:
        print(f"[Dev.to] Failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# 6. SIH / Unstop — Static real links (no scrape needed, always valid)
# ══════════════════════════════════════════════════════════════════════════════

def get_static_opportunities(dream: str) -> list[dict]:
    """
    Guaranteed-real opportunity links scoped to the user's career dream.
    These are live search/category pages on major Indian platforms.
    """
    q = dream.replace(" ", "+")
    skills = _skills_for_dream(dream)
    search_term = _dream_to_search_term(dream)
    sq = search_term.replace(" ", "+")

    # Dream-specific platform links
    is_upsc = any(k in dream.lower() for k in ["ias", "upsc", "civil", "ips", "magistrate"])
    is_tech  = any(k in dream.lower() for k in ["engineer", "developer", "software", "data", "ai", "ml", "tech"])

    opps = []

    if is_upsc:
        opps += [
            {
                "type": "Job", "title": "UPSC Civil Services Exam 2025",
                "company": "Union Public Service Commission",
                "location": "Pan India", "description": "Apply for IAS/IPS/IFS through the annual UPSC CSE.",
                "requiredSkills": skills, "matchPercentage": 98,
                "applyUrl": "https://upsc.gov.in/", "searchUrl": "https://upsc.gov.in/",
                "platform": "upsc", "source": "UPSC", "actionText": "Apply on UPSC", "isReal": True,
            },
            {
                "type": "Internship", "title": "Government Internship Program",
                "company": "MyGov India", "location": "Pan India",
                "description": "Internship opportunities with Government of India ministries.",
                "requiredSkills": skills, "matchPercentage": 90, "stipend": "As per scheme",
                "applyUrl": "https://internship.aicte-india.org/", "searchUrl": "https://internship.aicte-india.org/",
                "platform": "aicte", "source": "AICTE", "actionText": "Apply via AICTE", "isReal": True,
            },
            {
                "type": "Hackathon", "title": f"Browse {dream} Competitions",
                "company": "Unstop", "location": "Online",
                "description": "Case studies, essay contests and public policy challenges for aspirants.",
                "requiredSkills": ["Essay Writing", "Analytical Thinking", "Current Affairs"],
                "matchPercentage": 85,
                "applyUrl": f"https://unstop.com/competitions?q={q}",
                "searchUrl": f"https://unstop.com/competitions?q={q}",
                "platform": "unstop", "source": "Unstop", "actionText": "Browse on Unstop", "isReal": True,
            },
        ]
    else:
        opps += [
            {
                "type": "Hackathon", "title": "Smart India Hackathon 2025",
                "company": "Ministry of Education, Govt. of India",
                "location": "Pan India", "description": "India's largest student hackathon — 1 lakh+ participants.",
                "prize": "₹1,00,000+", "requiredSkills": ["Teamwork", "Innovation", "Problem Solving"],
                "matchPercentage": 90,
                "applyUrl": "https://www.sih.gov.in/", "searchUrl": "https://www.sih.gov.in/",
                "platform": "sih", "source": "SIH", "actionText": "Visit SIH Portal", "isReal": True,
            },
            {
                "type": "Hackathon", "title": f"Browse {dream} Challenges",
                "company": "Unstop (D2C)", "location": "Online",
                "description": "Find competitions and hackathons on Unstop.",
                "requiredSkills": skills, "matchPercentage": 86,
                "applyUrl": f"https://unstop.com/hackathons?q={q}",
                "searchUrl": f"https://unstop.com/hackathons?q={q}",
                "platform": "unstop", "source": "Unstop", "actionText": "Browse on Unstop", "isReal": True,
            },
            {
                "type": "Internship", "title": f"{dream} Internships",
                "company": "Internshala", "location": "Remote / Hybrid",
                "description": f"Browse latest {dream} internships on Internshala.",
                "stipend": "₹5,000 – ₹20,000/month",
                "requiredSkills": skills, "matchPercentage": 84,
                "applyUrl": f"https://internshala.com/internships/{sq}-internship",
                "searchUrl": f"https://internshala.com/internships/{sq}-internship",
                "platform": "internshala", "source": "Internshala", "actionText": "Apply on Internshala", "isReal": True,
            },
        ]

    # Always add Naukri search for jobs
    opps.append({
        "type": "Job", "title": f"{dream} Jobs in India",
        "company": "Naukri.com", "location": "Pan India",
        "description": f"Browse verified {dream} job listings on Naukri.",
        "requiredSkills": skills, "matchPercentage": 80,
        "applyUrl": f"https://www.naukri.com/{sq.replace('+', '-')}-jobs",
        "searchUrl": f"https://www.naukri.com/{sq.replace('+', '-')}-jobs",
        "platform": "naukri", "source": "Naukri", "actionText": "Search on Naukri", "isReal": True,
    })

    return opps


# ══════════════════════════════════════════════════════════════════════════════
# 7. MASTER AGGREGATOR — all opportunities in parallel
# ══════════════════════════════════════════════════════════════════════════════

async def get_real_opportunities(dream: str) -> list[dict]:
    """
    Fetch ALL real opportunity data in parallel with 6h caching.
    Priority: Adzuna jobs → Internshala → Devfolio → Static (SIH/Unstop)
    """
    cache_key = dream.lower().strip()
    cached = _cache_get(_cache, cache_key)
    if cached is not None:
        print(f"[RealData] Cache hit for '{dream}'")
        return cached

    print(f"[RealData] Fetching live opportunities for '{dream}'...")
    jobs_task       = fetch_adzuna_jobs(dream, max_results=4)
    hackathons_task = fetch_devfolio_hackathons(dream, max_results=3)
    internship_task = fetch_internshala_internships(dream, max_results=3)

    jobs, hackathons, internships = await asyncio.gather(
        jobs_task, hackathons_task, internship_task,
        return_exceptions=True,
    )

    result: list[dict] = []
    result += [j for j in (jobs if isinstance(jobs, list) else []) if isinstance(j, dict)]
    result += [i for i in (internships if isinstance(internships, list) else []) if isinstance(i, dict)]
    result += [h for h in (hackathons if isinstance(hackathons, list) else []) if isinstance(h, dict)]
    result += get_static_opportunities(dream)  # always add these guaranteed links

    # Deduplicate by applyUrl
    seen_urls: set[str] = set()
    unique: list[dict] = []
    for opp in result:
        url = opp.get("applyUrl", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique.append(opp)

    _cache_set(_cache, cache_key, unique)
    print(f"[RealData] ✓ Total {len(unique)} real opportunities for '{dream}'")
    return unique


async def get_real_news(topic: str) -> list[dict]:
    """
    Fetch real news/articles for a topic. Uses HackerNews + Dev.to in parallel.
    """
    cache_key = topic.lower().strip()
    cached = _cache_get(_news_cache, cache_key)
    if cached is not None:
        return cached

    hn_task, devto_task = await asyncio.gather(
        fetch_hackernews(topic, count=5),
        fetch_devto(topic, count=5),
        return_exceptions=True,
    )

    articles: list[dict] = []
    articles += hn_task    if isinstance(hn_task, list)    else []
    articles += devto_task if isinstance(devto_task, list) else []

    # Deduplicate by link
    seen: set[str] = set()
    unique = []
    for a in articles:
        link = a.get("link", "")
        if link and link not in seen:
            seen.add(link)
            unique.append(a)

    _cache_set(_news_cache, cache_key, unique)
    return unique
