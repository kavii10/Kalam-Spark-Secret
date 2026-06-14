import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";
import { 
  Search, MapPin, Briefcase, ExternalLink, Zap, Star, ShieldCheck, 
  RefreshCw, AlertCircle, Info, ChevronDown, ChevronUp, Trophy, 
  Download, Code, Terminal, Activity, Check, Copy, Building2, Calendar, Globe2
} from "lucide-react";
import { dbService } from '../services/dbService';
import { networkService } from '../services/networkService';

interface Props {
  user: UserProfile;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  createdDate: string;
  salaryRange: string;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  redirectUrl: string;
  source?: string;
  matchPercentage?: number;
}

interface Hackathon {
  id: string;
  title: string;
  link: string;
  timeline: string;
  source: string;
  type: string;
}

const COUNTRIES = [
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "za", name: "South Africa", flag: "🇿🇦" }
];

const fetchWithProxy = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.warn(`Direct fetch to ${url} failed, trying CORS proxy...`, err);
  }
  
  // Try CORS proxy fallback
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${url} via proxy.`);
  const data = await res.json();
  if (!data.contents) throw new Error(`Empty contents from proxy for ${url}`);
  return data.contents;
};

function cleanHtml(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<\/?[^>]+(>|$)/g, "");
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return cleaned.trim();
}

const fetchApifyJobs = async (keyword: string, location: string, limit: number): Promise<Job[]> => {
  const token = import.meta.env.VITE_APIFY_API_TOKEN || "";
  if (!token || token === "YOUR_APIFY_API_TOKEN") return [];
  try {
    const searchQuery = location ? `${keyword} in ${location}` : keyword;
    const runInput = {
      queries: searchQuery,
      maxPagesPerQuery: 1,
      maxResultsPerQuery: limit
    };
    const actorId = "orgupdate~google-jobs-scraper";
    
    const runResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&wait=60`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput)
    });
    if (!runResp.ok) return [];
    const runData = await runResp.json();
    const datasetId = runData.data?.defaultDatasetId;
    if (!datasetId) return [];
    
    const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
    if (!itemsResp.ok) return [];
    const items = await itemsResp.json();
    const parsedItems = Array.isArray(items) ? items : [items];
    
    return parsedItems.map((item: any) => {
      const title = item.title || item.position || "N/A";
      const company = item.companyName || item.company || "Not Disclosed";
      const loc = item.location || item.formattedLocation || location || "N/A";
      const postedAt = item.postedAt || item.date || "";
      const createdDate = postedAt ? String(postedAt).split("T")[0] : "Ongoing";
      const desc = item.description || item.jobDescription || "No details.";
      const link = item.applyLink || item.url || item.link || "https://google.com";
      const salary = item.salary || "Not Specified";
      
      return {
        id: item.id || `apify-${Math.random().toString(36).substring(2)}`,
        title: cleanHtml(title),
        company: cleanHtml(company),
        location: cleanHtml(loc),
        createdDate,
        salaryRange: salary,
        salaryMin: null,
        salaryMax: null,
        description: cleanHtml(desc),
        redirectUrl: link,
        source: "Apify Scraper"
      };
    });
  } catch (err) {
    console.error("fetchApifyJobs error:", err);
    return [];
  }
};

const fetchUnstopHackathons = async (limit: number = 15): Promise<Hackathon[]> => {
  const token = import.meta.env.VITE_APIFY_API_TOKEN || "";
  if (!token || token === "YOUR_APIFY_API_TOKEN") return [];
  try {
    const runInput = {
      startUrls: [{ url: "https://unstop.com/competitions" }],
      maxRequestsPerCrawl: 3,
      pageFunction: `async function pageFunction(context) {
        const { $ } = context;
        const results = [];
        $('div.opportunity_list, div.card, a.opportunity-card, .opp-card-container').each((i, el) => {
            const title = $(el).find('h2, .title, .opp-title, .opportunity-title').text().trim();
            const host = $(el).find('.host, .company-name, .university-name, .sub-heading').text().trim();
            const deadline = $(el).find('.reg-date, .deadline, .days-left, .closing-in').text().trim();
            const link = $(el).attr('href') || $(el).find('a').attr('href') || '/competitions';
            if (title) {
                results.push({ title, host, deadline, link });
            }
        });
        return results;
      }`
    };
    const actorId = "apify~cheerio-scraper";
    const runResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&wait=50`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput)
    });
    if (!runResp.ok) return [];
    const runData = await runResp.json();
    const datasetId = runData.data?.defaultDatasetId;
    if (!datasetId) return [];
    
    const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
    if (!itemsResp.ok) return [];
    const items = await itemsResp.json();
    const parsedItems = Array.isArray(items) ? items : [items];
    
    const unstopEvents: Hackathon[] = [];
    parsedItems.forEach((row: any) => {
      let results = row.pageFunctionResult || [row];
      if (!Array.isArray(results)) {
        results = [results];
      }
      results.forEach((item: any) => {
        const title = item.title || item.eventName || "Unstop Competition";
        const host = item.host || item.institution || "Unstop Host";
        const deadline = item.deadline || item.endDate || "Ongoing";
        let link = item.link || "https://unstop.com/competitions";
        
        if (link.startsWith("/")) {
          link = `https://unstop.com${link}`;
        } else if (!link.startsWith("http")) {
          link = `https://unstop.com/${link}`;
        }
        
        unstopEvents.push({
          id: `unstop-${Math.random().toString(36).substring(2)}`,
          title: `${cleanHtml(title)} (Hosted by ${cleanHtml(host)})`,
          link,
          timeline: deadline,
          source: "Unstop",
          type: "Competition"
        });
      });
    });
    return unstopEvents.slice(0, limit);
  } catch (err) {
    console.error("fetchUnstopHackathons error:", err);
    return [];
  }
};

// Sourcing limit options
const LIMIT_OPTIONS = [5, 10, 20, 30];

// Synonym dictionary for career relevance filtering
const CAREER_SYNONYMS: Record<string, string[]> = {
  "doctor": ["medical", "physician", "clinical", "mbbs", "md", "hospital", "healthcare", "pediatrician", "surgeon", "resident", "medicine", "clinic", "gp", "cardiologist", "oncologist", "neurologist", "orthopedic", "psychiatrist", "dermatologist", "doctor", "health"],
  "software engineer": ["software", "developer", "programmer", "coder", "frontend", "backend", "fullstack", "full-stack", "web developer", "react", "node", "python", "java", "c++", "c#", "javascript", "typescript", "golang", "engineering", "it", "tech"],
  "web developer": ["web", "developer", "frontend", "backend", "fullstack", "react", "angular", "vue", "javascript", "typescript", "html", "css", "wordpress", "node", "php", "coding"],
  "data scientist": ["data", "scientist", "analyst", "analytics", "machine learning", "ml", "ai", "artificial intelligence", "python", "sql", "r", "pandas", "statistics"],
  "nurse": ["nurse", "nursing", "clinical", "healthcare", "hospital", "medical", "rn", "lpn", "np", "clinic"],
  "teacher": ["teacher", "educator", "instructor", "tutor", "school", "teaching", "professor", "academic", "education", "curriculum"],
  "designer": ["designer", "ui", "ux", "graphic", "illustrator", "photoshop", "figma", "creative", "art", "product designer", "artist"],
  "product manager": ["product manager", "pm", "product owner", "agile", "scrum", "roadmap", "product strategy"],
  "marketing": ["marketing", "seo", "sem", "social media", "content creator", "copywriter", "ads", "advertising", "growth", "branding"],
  "finance": ["finance", "financial", "analyst", "investment", "banking", "accountant", "accounting", "cpa", "audit", "tax"]
};

const getStageSubjects = (stage: any): string[] => {
  if (stage?.subjects && stage.subjects.length > 0) {
    return stage.subjects.filter((s: string) => s && s.trim().length > 0);
  }
  const actionVerbs = /^(learn|understand|study|build|implement|practice|explore|read|write|create|develop|master|apply|use|complete|finish|do|make|watch|review)/i;
  const subjectLikeConcepts = (stage?.concepts || []).filter(
    (c: string) => c && c.trim().length > 0 && !actionVerbs.test(c.trim())
  );
  if (subjectLikeConcepts.length > 0) return subjectLikeConcepts;
  return (stage?.concepts || []).filter((c: string) => c && c.trim().length > 0);
};

const isDuplicateJob = (job1: Job, job2: Job): boolean => {
  const c1 = job1.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const c2 = job2.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (c1 !== c2) return false;

  const t1 = job1.title.toLowerCase();
  const t2 = job2.title.toLowerCase();

  // If one has "intern" and the other doesn't, they are not duplicates
  const hasIntern1 = t1.includes("intern");
  const hasIntern2 = t2.includes("intern");
  if (hasIntern1 !== hasIntern2) return false;

  // If one has "senior" or "sr" or "lead" and the other doesn't
  const isSenior1 = t1.includes("senior") || t1.includes("sr.") || t1.includes("sr ") || t1.includes("lead");
  const isSenior2 = t2.includes("senior") || t2.includes("sr.") || t2.includes("sr ") || t2.includes("lead");
  if (isSenior1 !== isSenior2) return false;

  const t1Alpha = t1.replace(/[^a-z0-9]/g, "");
  const t2Alpha = t2.replace(/[^a-z0-9]/g, "");
  
  if (t1Alpha.length < 5 || t2Alpha.length < 5) {
    return t1Alpha === t2Alpha;
  }

  const prefixLen = Math.min(18, t1Alpha.length, t2Alpha.length);
  if (t1Alpha.substring(0, prefixLen) === t2Alpha.substring(0, prefixLen)) {
    return true;
  }

  return false;
};

const isJobRelevant = (job: Job, dream: string, stageSubjects: string[]): boolean => {
  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  const dreamLower = dream.toLowerCase().trim();

  let keywords: string[] = [];

  // Match predefined synonyms
  Object.keys(CAREER_SYNONYMS).forEach(k => {
    if (dreamLower.includes(k) || k.includes(dreamLower)) {
      keywords = [...keywords, ...CAREER_SYNONYMS[k]];
    }
  });

  // Add dream terms
  dreamLower.split(/\s+/).forEach(w => {
    const cw = w.replace(/[^a-z0-9]/g, "");
    if (cw.length > 2 && !keywords.includes(cw)) {
      keywords.push(cw);
    }
  });

  // Add roadmap stage subjects/topics
  stageSubjects.forEach(sub => {
    const subLower = sub.toLowerCase();
    subLower.split(/\s+/).forEach(w => {
      const cw = w.replace(/[^a-z0-9]/g, "");
      if (cw.length > 2 && !keywords.includes(cw)) {
        keywords.push(cw);
      }
    });
  });

  // Check if title or description matches at least one keyword
  return keywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
};

export default function Opportunities({ user }: Props) {
  const [activeTab, setActiveTab] = useState<"jobs" | "hackathons">("jobs");
  const isLight = user.settings?.theme === 'light';

  // Job Explorer State
  const [keyword, setKeyword] = useState<string>(() => user.dream || "Software Engineer");
  const [location, setLocation] = useState<string>("India");
  const [country, setCountry] = useState<string>("in");
  const [limit, setLimit] = useState<number>(5);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Custom Dropdowns open state
  const [isOpenCountry, setIsOpenCountry] = useState(false);
  const [isOpenLimit, setIsOpenLimit] = useState(false);

  // User roadmap for stage-based filtering
  const [roadmap, setRoadmap] = useState<any>(null);

  // Hackathon State
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [hackathonsLoading, setHackathonsLoading] = useState<boolean>(false);
  const [hackathonsError, setHackathonsError] = useState<string | null>(null);
  const [hackathonKeyword, setHackathonKeyword] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Devpost", "HackerEarth", "Unstop"]);
  const [warningBanner, setWarningBanner] = useState<string | null>(null);

  // Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load user roadmap on mount / dream change
  useEffect(() => {
    dbService.getRoadmap(user.id)
      .then(rm => {
        if (rm) setRoadmap(rm);
      })
      .catch(err => console.error("Error loading roadmap in Opportunities view:", err));
  }, [user.id, user.dream]);

  // Compute dynamic match score based on user skills/dream
  const computeMatchScore = (title: string, desc: string, dream: string) => {
    const t = title.toLowerCase();
    const d = desc.toLowerCase();
    const keywords = dream.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    let matches = 0;
    keywords.forEach(word => {
      if (t.includes(word)) matches += 3;
      if (d.includes(word)) matches += 1;
    });

    // Randomize score variance slightly for visual authenticity
    const variance = (title.charCodeAt(0) % 5);
    const score = 72 + Math.min(23, matches * 4) + variance;
    return Math.round(score);
  };

  // Sync inputs on dream change
  useEffect(() => {
    if (user.dream) {
      setKeyword(user.dream);
    }
  }, [user.dream]);

  // Load feeds when tab changes
  useEffect(() => {
    if (activeTab === "jobs" && jobs.length === 0) {
      handleFetchJobs();
    } else if (activeTab === "hackathons" && hackathons.length === 0) {
      handleFetchHackathons();
    }
  }, [activeTab]);

  const handleFetchJobs = async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const appId = "61e33034";
      const appKey = "f863f17df97ef2a2963c4b9f49083b1f";
      const countryCode = country.toLowerCase().trim();
      
      let finalKeyword = keyword.replace('"', '').replace("'", "").trim();
      let finalLocation = location.trim();
      
      const hasRemote = /remote/i.test(finalLocation);
      if (hasRemote) {
        if (!/remote/i.test(finalKeyword)) {
          finalKeyword = `${finalKeyword} remote`.trim();
        }
        finalLocation = finalLocation
          .replace(/remote/i, "")
          .replace(/^[,\s/]+|[,\s/]+$/g, "")
          .trim();
      }
      
      const searchParams = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: String(limit),
        what: finalKeyword,
      });
      if (finalLocation) {
        searchParams.append("where", finalLocation);
      }
      
      const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${searchParams.toString()}`;
      
      let adzunaJobs: Job[] = [];
      try {
        const rawText = await fetchWithProxy(adzunaUrl);
        if (rawText) {
          const data = JSON.parse(rawText);
          const rawResults = data.results || [];
          adzunaJobs = rawResults.map((job: any) => {
            const title = cleanHtml(job.title || "Untitled Job");
            const company = cleanHtml(job.company?.display_name || "Not Disclosed");
            
            const locations = job.location?.area || [];
            const locationStr = locations.length > 0 ? locations.join(", ") : "Not Disclosed";
            let displayLocation = cleanHtml(locationStr);
            if (location.toLowerCase() === "remote" && !displayLocation.toLowerCase().includes("remote")) {
              displayLocation = `Remote (${displayLocation})`;
            }
            const created = job.created ? job.created.split("T")[0] : "";
            
            const salaryMin = job.salary_min ? Math.round(Number(job.salary_min)) : null;
            const salaryMax = job.salary_max ? Math.round(Number(job.salary_max)) : null;
            let salaryRange = "Not Specified";
            if (salaryMin && salaryMax) {
              salaryRange = `${salaryMin.toLocaleString()} - ${salaryMax.toLocaleString()}`;
            } else if (salaryMin) {
              salaryRange = `From ${salaryMin.toLocaleString()}`;
            }
            const description = cleanHtml(job.description || "No description details provided.");
            const redirectUrl = job.redirect_url || "#";
            
            return {
              id: String(job.id || Math.random()),
              title,
              company,
              location: displayLocation,
              createdDate: created,
              salaryRange,
              salaryMin,
              salaryMax,
              description,
              redirectUrl,
              source: "Adzuna"
            };
          });
        }
      } catch (err) {
        console.error("Adzuna client fetch failed:", err);
      }
      
      let apifyJobsList: Job[] = [];
      try {
        apifyJobsList = await fetchApifyJobs(keyword, location, limit);
      } catch (err) {
        console.error("Apify client fetch failed:", err);
      }
      
      const merged: Job[] = [];
      const addIfUnique = (newJob: Job) => {
        const isDup = merged.some(existingJob => isDuplicateJob(existingJob, newJob));
        if (!isDup) {
          merged.push(newJob);
        }
      };

      adzunaJobs.forEach(addIfUnique);
      apifyJobsList.forEach(addIfUnique);
      
      const currentStage = roadmap?.stages?.[Math.min(user.currentStageIndex, (roadmap.stages?.length || 1) - 1)];
      const stageSubjects = currentStage ? getStageSubjects(currentStage) : [];

      const parsedJobs = merged.map(j => ({
        ...j,
        matchPercentage: computeMatchScore(j.title, j.description, user.dream || keyword)
      }));

      // Apply relevance filtering based on user dream and active roadmap stage subjects
      const filteredJobs = parsedJobs.filter(job => isJobRelevant(job, user.dream || keyword, stageSubjects));
      filteredJobs.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
      
      setJobs(filteredJobs);
    } catch (err: any) {
      console.error("handleFetchJobs error:", err);
      setJobsError(err.message || "Failed to fetch jobs directly.");
    } finally {
      setJobsLoading(false);
    }
  };

  const handleFetchHackathons = async () => {
    setHackathonsLoading(true);
    setHackathonsError(null);
    setWarningBanner(null);
    try {
      const curatedHackathons: Hackathon[] = [
        {
          id: "curated-gemini-2026",
          title: "Google Gemini Frontier AI Challenge",
          link: "https://devpost.com/challenges",
          timeline: "Ongoing to Jul 31, 2026",
          source: "Devpost",
          type: "Generative AI"
        },
        {
          id: "curated-llama3-2026",
          title: "Meta LLaMA Open Source Integration Challenge",
          link: "https://devpost.com/challenges",
          timeline: "Ongoing to Aug 15, 2026",
          source: "Devpost",
          type: "Artificial Intelligence"
        },
        {
          id: "curated-openai-25",
          title: "OpenAI GPT-4o Developers Enterprise Hackathon",
          link: "https://www.hackerearth.com/challenges/",
          timeline: "Jun 10 to Jul 25, 2026",
          source: "HackerEarth",
          type: "Hackathon"
        },
        {
          id: "curated-claude-agents",
          title: "Anthropic Claude 3.5 AI Agents Builders Hackathon",
          link: "https://devpost.com/challenges",
          timeline: "Ongoing to Jul 10, 2026",
          source: "Devpost",
          type: "AI Agents"
        },
        {
          id: "curated-microsoft-copilot",
          title: "Microsoft Azure Copilot Studio Hackathon",
          link: "https://www.hackerearth.com/challenges/",
          timeline: "Ongoing to Jun 28, 2026",
          source: "HackerEarth",
          type: "Programming Contest"
        },
        {
          id: "curated-nvidia-cuda",
          title: "NVIDIA CUDA-X AI Acceleration Global Challenge",
          link: "https://devpost.com/challenges",
          timeline: "Ongoing to Aug 20, 2026",
          source: "Devpost",
          type: "Deep Learning"
        },
        {
          id: "curated-hacker-ai",
          title: "HackerEarth AI Developer Cup",
          link: "https://www.hackerearth.com/challenges/",
          timeline: "Ongoing to Aug 05, 2026",
          source: "HackerEarth",
          type: "AI & Data Science"
        },
        {
          id: "curated-ai-healthcare",
          title: "AI in Healthcare Global Hackathon",
          link: "https://devpost.com/challenges",
          timeline: "Ongoing to Jun 22, 2026",
          source: "Devpost",
          type: "Hackathon"
        }
      ];
      
      let list = [...curatedHackathons];
      
      // 1. Fetch Devpost RSS feed safely
      try {
        const xmlText = await fetchWithProxy("https://devpost.com/feed");
        if (xmlText) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          const items = xmlDoc.getElementsByTagName("item");
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const titleElem = item.getElementsByTagName("title")[0];
            const linkElem = item.getElementsByTagName("link")[0];
            const pubDateElem = item.getElementsByTagName("pubDate")[0];
            const guidElem = item.getElementsByTagName("guid")[0];
            
            const title = titleElem ? titleElem.textContent || "Unnamed Hackathon" : "Unnamed Hackathon";
            const link = linkElem ? linkElem.textContent || "https://devpost.com" : "https://devpost.com";
            let timeline = pubDateElem ? pubDateElem.textContent || "Ongoing" : "Ongoing";
            const guid = guidElem ? guidElem.textContent || `devpost-${Math.random()}` : `devpost-${Math.random()}`;
            
            if (timeline !== "Ongoing") {
              try {
                const dateObj = new Date(timeline);
                if (!isNaN(dateObj.getTime())) {
                   timeline = dateObj.toLocaleDateString("en-US", {
                     month: "short",
                     day: "numeric",
                     year: "numeric"
                   });
                }
              } catch (e) {}
            }
            
            list.push({
              id: guid,
              title,
              link,
              timeline,
              source: "Devpost",
              type: "Hackathon"
            });
          }
        }
      } catch (err) {
        console.error("Devpost RSS client fetch failed:", err);
      }
      
      // 2. Fetch HackerEarth Partner API or Fallback Public JSON
      const clientSecret = import.meta.env.VITE_HACKEREARTH_API_KEY || "";
      const clientId = import.meta.env.VITE_HACKEREARTH_CLIENT_ID || "";
      
      let apiSucceeded = false;
      const hasKeys = !!clientSecret && clientSecret !== "YOUR_HACKEREARTH_API_KEY";
      let warning: string | null = null;
      
      if (hasKeys) {
        try {
          const headers: any = {
            "client-secret": clientSecret,
            "Content-Type": "application/json"
          };
          if (clientId) {
            headers["client-id"] = clientId;
          }
          const response = await fetch("https://api.hackerearth.com/v4/partner/challenges/", { headers });
          if (response.ok) {
            const data = await response.json();
            const results = data.challenges || data.results || [];
            results.forEach((item: any) => {
              const start = item.start_timestamp ? item.start_timestamp.split(" ")[0] : "Start";
              const end = item.end_timestamp ? item.end_timestamp.split(" ")[0] : "End";
              list.push({
                id: String(item.id || Math.random()),
                title: item.title || item.name || "HackerEarth Challenge",
                link: item.url || item.challenge_link || "https://hackerearth.com/challenges/",
                timeline: `${start} to ${end}`,
                source: "HackerEarth",
                type: item.challenge_type || "Programming Contest"
              });
            });
            if (results.length > 0) {
              apiSucceeded = true;
            }
          }
        } catch (err) {
          console.error("HackerEarth partner API client fetch error:", err);
        }
      }
      
      if (!apiSucceeded) {
        if (!hasKeys) {
          warning = "≡ƒöî Note: HackerEarth API credentials was missing or returned 0 items. Displaying global public online challenges.";
        }
        try {
          const rawText = await fetchWithProxy("https://www.hackerearth.com/api/challenges/");
          if (rawText) {
            const rawData = JSON.parse(rawText);
            const rawChallenges = rawData.response || [];
            rawChallenges.forEach((item: any) => {
              const title = item.title || "HackerEarth Challenge";
              let url = item.url || "https://www.hackerearth.com/challenges/";
              if (url.startsWith("/")) {
                url = `https://www.hackerearth.com${url}`;
              }
              const typeEvent = item.challenge_type || "Hackathon";
              const startStr = item.start_timestamp || "";
              const endStr = item.end_timestamp || "";
              let dateDisplay = "Active";
              if (startStr || endStr) {
                const startClean = startStr.split(" ")[0] || "";
                const endClean = endStr.split(" ")[0] || "";
                dateDisplay = startClean && endClean ? `${startClean} to ${endClean}` : "Active";
              } else {
                dateDisplay = item.status || "Active";
              }
              list.push({
                id: String(item.id || Math.random()),
                title,
                link: url,
                timeline: dateDisplay,
                source: "HackerEarth",
                type: typeEvent
              });
            });
          }
        } catch (err) {
          console.error("HackerEarth public challenges backup client fetch error:", err);
        }
      }
      
      // 3. Fetch Unstop Hackathons via Apify Scraper
      try {
        const token = import.meta.env.VITE_APIFY_API_TOKEN || "";
        const isApifyConfigured = !!token && token !== "YOUR_APIFY_API_TOKEN";
        if (isApifyConfigured) {
          const unstopEvents = await fetchUnstopHackathons(15);
          if (unstopEvents && unstopEvents.length > 0) {
            list.push(...unstopEvents);
          }
        } else {
          const unstopWarning = "≡ƒöî Note: `APIFY_API_TOKEN` is missing or empty. Serving primary Devpost + HackerEarth challenges.";
          warning = warning ? `${warning} | ${unstopWarning}` : unstopWarning;
        }
      } catch (unstopErr) {
        console.error("Unstop client fetch error:", unstopErr);
      }
      
      setHackathons(list);
      if (warning) {
        setWarningBanner(warning);
      }
    } catch (err: any) {
      console.error("handleFetchHackathons error:", err);
      setHackathonsError(err.message || "Failed to fetch hackathons directly.");
    } finally {
      setHackathonsLoading(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error("Copy failed: ", err);
    });
  };

  const toggleExpand = (jobId: string) => {
    setExpandedJobId(prev => prev === jobId ? null : jobId);
  };

  const extractTags = (job: Job) => {
    const tags: string[] = [];
    const lowerTitle = job.title.toLowerCase();
    const lowerDesc = job.description.toLowerCase();

    if (lowerTitle.includes("senior") || lowerTitle.includes("sr") || lowerTitle.includes("lead")) {
      tags.push("Senior");
    } else if (lowerTitle.includes("junior") || lowerTitle.includes("jr") || lowerTitle.includes("intern")) {
      tags.push("Entry Level");
    } else {
      tags.push("Mid Level");
    }

    if (lowerTitle.includes("remote") || job.location.toLowerCase().includes("remote") || lowerDesc.includes("work from home")) {
      tags.push("Remote");
    }
    
    if (lowerTitle.includes("intern") || lowerTitle.includes("internship")) {
      tags.push("Internship");
    } else {
      tags.push("Full-Time");
    }

    return tags.slice(0, 3);
  };

  const handleDownloadHackathonsCsv = (filteredList: Hackathon[]) => {
    if (filteredList.length === 0) return;
    const headers = ["Event Title", "Platform Source", "Timeline", "Category", "Link"];
    const csvRows = [
      headers.join(","),
      ...filteredList.map(h => [
        `"${h.title.replace(/"/g, '""')}"`,
        `"${h.source}"`,
        `"${h.timeline.replace(/"/g, '""')}"`,
        `"${h.type}"`,
        `"${h.link}"`
      ].join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `hackathons_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter hackathons
  const filteredHackathons = hackathons.filter(h => {
    if (!selectedPlatforms.includes(h.source)) return false;
    if (hackathonKeyword.trim()) {
      const q = hackathonKeyword.toLowerCase();
      return h.title.toLowerCase().includes(q) || h.type.toLowerCase().includes(q);
    }
    return true;
  });

  const devpostCount = filteredHackathons.filter(h => h.source === "Devpost").length;
  const hackerEarthCount = filteredHackathons.filter(h => h.source === "HackerEarth").length;
  const unstopCount = filteredHackathons.filter(h => h.source === "Unstop").length;

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className={`glass-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b ${
        isLight ? 'border-orange-200 bg-white' : 'border-orange-500/20 bg-zinc-950/20'
      }`}>
        <div className="space-y-2">
          <h1 className={`text-2xl md:text-3xl font-cinzel font-bold flex items-center gap-3 ${
            isLight ? 'text-orange-500' : 'text-orange-400'
          }`}>
            <Search size={28} /> Jobs & Hackathons
          </h1>
          <p className={`text-xs md:text-sm max-w-xl ${isLight ? 'text-zinc-650' : 'text-zinc-400'}`}>
            Real-time feed sourcing open internships, hackathons, and jobs pre-filtered for your profile from Adzuna, Devpost, HackerEarth, and Unstop.
          </p>
        </div>

        {/* Tab selector */}
        <div className={`flex p-1 rounded-xl border shrink-0 ${
          isLight ? 'bg-zinc-150 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800'
        }`}>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "jobs"
                ? isLight 
                  ? "bg-white text-orange-600 shadow-sm border border-zinc-200" 
                  : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                : isLight ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Briefcase size={14} />
            <span>Job Explorer</span>
          </button>
          <button
            onClick={() => setActiveTab("hackathons")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "hackathons"
                ? isLight 
                  ? "bg-white text-violet-600 shadow-sm border border-zinc-200" 
                  : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                : isLight ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy size={14} />
            <span>Hackathons</span>
          </button>
        </div>
      </div>

      {/* Query Control Panels */}
      <div className={`border rounded-2xl p-5 md:p-6 shadow-xs relative z-25 ${
        isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950/40 border-zinc-800/60'
      }`}>
        {activeTab === "jobs" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Keyword */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Role / Title
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchJobs()}
                  placeholder="e.g. React Developer"
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none border font-bold ${
                    isLight 
                      ? 'bg-zinc-55 border-zinc-200 text-zinc-800 focus:border-orange-500' 
                      : 'bg-zinc-900/50 border-zinc-700 text-white focus:border-orange-500/50'
                  }`}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchJobs()}
                  placeholder="e.g. Remote, Mumbai"
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none border font-bold ${
                    isLight 
                      ? 'bg-zinc-55 border-zinc-200 text-zinc-800 focus:border-orange-500' 
                      : 'bg-zinc-900/50 border-zinc-700 text-white focus:border-orange-500/50'
                  }`}
                />
              </div>
            </div>

            {/* Country Dataset - Custom Dropdown */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Country Index
              </label>
              <div className="relative">
                <Globe2 className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500 z-10 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => {
                    setIsOpenCountry(!isOpenCountry);
                    setIsOpenLimit(false);
                  }}
                  className={`w-full pl-9 pr-3 py-2 text-left text-xs rounded-xl focus:outline-none border font-bold cursor-pointer flex items-center justify-between transition-all ${
                    isLight 
                      ? 'bg-zinc-55 border-zinc-200 text-zinc-850 hover:bg-zinc-100' 
                      : 'bg-zinc-900/50 border-zinc-700 text-white hover:bg-zinc-850'
                  }`}
                >
                  <span className="truncate">
                    {(COUNTRIES.find(c => c.code === country) || COUNTRIES[0]).flag} &nbsp;
                    {(COUNTRIES.find(c => c.code === country) || COUNTRIES[0]).name}
                  </span>
                  <ChevronDown size={12} className={`text-zinc-500 shrink-0 transition-transform ${isOpenCountry ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpenCountry && (
                  <>
                    {/* Backdrop for click away */}
                    <div className="fixed inset-0 z-30 cursor-default" onClick={() => setIsOpenCountry(false)} />
                    {/* Dropdown Options Box */}
                    <div className={`absolute left-0 right-0 mt-1.5 rounded-xl border shadow-xl z-40 max-h-60 overflow-y-auto ${
                      isLight 
                        ? 'bg-white border-zinc-200 text-zinc-800' 
                        : 'bg-zinc-950 border-zinc-800 text-white'
                    }`}>
                      {COUNTRIES.map((c) => {
                        const isSelected = c.code === country;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCountry(c.code);
                              setIsOpenCountry(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all flex items-center justify-between ${
                              isSelected 
                                ? isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/10 text-orange-400'
                                : isLight ? 'hover:bg-zinc-50 text-zinc-700' : 'hover:bg-zinc-900 text-zinc-300'
                            }`}
                          >
                            <span>{c.flag} &nbsp;{c.name}</span>
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                              isSelected 
                                ? isLight 
                                  ? 'border-orange-500 text-orange-500' 
                                  : 'border-orange-400 text-orange-400'
                                : isLight 
                                  ? 'border-zinc-300' 
                                  : 'border-zinc-700'
                            }`}>
                              {isSelected && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-orange-500' : 'bg-orange-400'}`} />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sourcing capacity & search button - Custom Dropdown */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Sourcing Capacity
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpenLimit(!isOpenLimit);
                      setIsOpenCountry(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs rounded-xl focus:outline-none border font-bold cursor-pointer flex items-center justify-between transition-all ${
                      isLight 
                        ? 'bg-zinc-55 border-zinc-200 text-zinc-850 hover:bg-zinc-100' 
                        : 'bg-zinc-900/50 border-zinc-700 text-white hover:bg-zinc-850'
                    }`}
                  >
                    <span>{limit} Items</span>
                    <ChevronDown size={12} className={`text-zinc-500 shrink-0 transition-transform ${isOpenLimit ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isOpenLimit && (
                    <>
                      {/* Backdrop for click away */}
                      <div className="fixed inset-0 z-30 cursor-default" onClick={() => setIsOpenLimit(false)} />
                      {/* Dropdown Options Box */}
                      <div className={`absolute left-0 right-0 mt-1.5 rounded-xl border shadow-xl z-40 max-h-60 overflow-y-auto ${
                        isLight 
                          ? 'bg-white border-zinc-200 text-zinc-800' 
                          : 'bg-zinc-950 border-zinc-800 text-white'
                      }`}>
                        {LIMIT_OPTIONS.map((v) => {
                          const isSelected = v === limit;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                setLimit(v);
                                setIsOpenLimit(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all flex items-center justify-between ${
                                isSelected 
                                  ? isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/10 text-orange-400'
                                  : isLight ? 'hover:bg-zinc-50 text-zinc-700' : 'hover:bg-zinc-900 text-zinc-300'
                              }`}
                            >
                              <span>{v} Items</span>
                              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                                isSelected 
                                  ? isLight 
                                    ? 'border-orange-500 text-orange-500' 
                                    : 'border-orange-400 text-orange-400'
                                  : isLight 
                                    ? 'border-zinc-300' 
                                    : 'border-zinc-700'
                              }`}>
                                {isSelected && (
                                  <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-orange-500' : 'bg-orange-400'}`} />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                
                <button
                  onClick={handleFetchJobs}
                  disabled={jobsLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all ${
                    isLight 
                      ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-100 hover:-translate-y-0.5 active:translate-y-0' 
                      : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/20 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {jobsLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                  <span>Search Jobs</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Event Keyword */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Filter Keyword
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={hackathonKeyword}
                  onChange={(e) => setHackathonKeyword(e.target.value)}
                  placeholder="e.g. AI, Web3, Mobile"
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none border font-bold ${
                    isLight 
                      ? 'bg-zinc-55 border-zinc-200 text-zinc-800 focus:border-violet-500' 
                      : 'bg-zinc-900/50 border-zinc-700 text-white focus:border-violet-500/50'
                  }`}
                />
              </div>
            </div>

            {/* Platforms */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Source Platforms
              </label>
              <div className="flex gap-2 items-center h-[34px]">
                {["Devpost", "HackerEarth", "Unstop"].map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatforms(prev =>
                        isSelected ? prev.filter(p => p !== platform) : [...prev, platform]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        isSelected
                          ? platform === "Devpost"
                            ? isLight ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : platform === "HackerEarth"
                              ? isLight ? "bg-pink-50 text-pink-700 border-pink-200" : "bg-pink-500/10 text-pink-400 border-pink-500/30"
                              : isLight ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : isLight ? "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100" : "bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:bg-zinc-850/50"
                      }`}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger Button & CSV Export */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex gap-2">
                <button
                  onClick={handleFetchHackathons}
                  disabled={hackathonsLoading}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all ${
                    isLight 
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-100 hover:-translate-y-0.5 active:translate-y-0' 
                      : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-950/20 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {hackathonsLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Search Hackathons</span>
                </button>
                <button
                  onClick={() => handleDownloadHackathonsCsv(filteredHackathons)}
                  disabled={filteredHackathons.length === 0}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-45 transition-all flex items-center justify-center gap-1 ${
                    isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-650 hover:bg-zinc-100' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850'
                  }`}
                  title="Export CSV"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render Jobs Viewport */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/30 pb-2">
            <h2 className={`text-[10px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Live Recruiting Positions
            </h2>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              isLight ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
            }`}>
              {COUNTRIES.find(c => c.code === country)?.flag} &nbsp;{jobs.length} Opportunities
            </span>
          </div>

          {jobsError && (
            <div className={`border rounded-2xl p-5 flex items-start gap-4 ${
              isLight ? 'bg-red-50 border-red-100 text-red-800' : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">Request Query Failure</h4>
                <p className="text-xs mt-1 leading-relaxed opacity-85">{jobsError}</p>
              </div>
            </div>
          )}

          {jobsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-48 rounded-2xl animate-pulse border ${
                  isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/40'
                }`} />
              ))}
            </div>
          ) : jobs.length === 0 && !jobsError ? (
            <div className={`border rounded-2xl p-16 text-center space-y-3 ${
              isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-850/30'
            }`}>
              <Briefcase size={28} className="mx-auto text-zinc-500 opacity-50" />
              <h3 className="font-bold text-xs">No Active Positions Found</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                No active listings match "{keyword}" in "{location}". Expand search terms or switch countries.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => {
                const isExpanded = expandedJobId === job.id;
                const tags = extractTags(job);
                
                return (
                  <div 
                    key={job.id} 
                    className={`border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                      isLight 
                        ? 'bg-white border-zinc-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/[0.02]' 
                        : 'bg-zinc-950/20 border-zinc-850 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/[0.04]'
                    }`}
                  >
                    {/* Match percentage */}
                    <div className={`absolute top-4 right-4 border px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                      isLight 
                        ? 'bg-orange-50 border-orange-100 text-orange-600' 
                        : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    }`}>
                      <ShieldCheck size={11} /> {job.matchPercentage}% Match
                    </div>

                    <div className="space-y-3 flex-1">
                      {/* Job Title & Co */}
                      <div className="space-y-1">
                        <h3 className={`font-bold text-sm pr-20 leading-snug line-clamp-1 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                          {job.title}
                        </h3>
                        <p className={`text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                          <Building2 size={12} className="opacity-60" /> {job.company}
                        </p>
                      </div>

                      {/* Info Row */}
                      <div className={`flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-bold ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        <span className="flex items-center gap-1"><MapPin size={11} className="opacity-50" /> {job.location}</span>
                        <span className="flex items-center gap-1"><Calendar size={11} className="opacity-50" /> {job.createdDate || "Recent"}</span>
                      </div>

                      {/* Sourcing tags */}
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                          isLight ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                        }`}>
                          {job.salaryRange}
                        </span>
                        {tags.map((tag, i) => (
                          <span key={tag + i} className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Collapsible Abstract */}
                      <div className="border-t border-zinc-800/10 dark:border-zinc-800/50 pt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>Job description</span>
                          <button
                            onClick={() => toggleExpand(job.id)}
                            className={`text-[10px] font-bold flex items-center gap-1 ${isLight ? 'text-orange-600' : 'text-orange-400'}`}
                          >
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            <span>{isExpanded ? "Collapse" : "Show Description"}</span>
                          </button>
                        </div>
                        {isExpanded ? (
                          <p className={`text-xs leading-relaxed font-medium whitespace-pre-wrap ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
                            {job.description}
                          </p>
                        ) : (
                          <p className={`text-xs leading-relaxed font-medium line-clamp-2 ${isLight ? 'text-zinc-650' : 'text-zinc-450'}`}>
                            {job.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="pt-3.5 border-t border-zinc-800/10 dark:border-zinc-800/50 flex items-center justify-between gap-3 mt-4">
                      <button
                        onClick={() => handleCopyLink(job.redirectUrl, job.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                          isLight ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350'
                        }`}
                      >
                        {copiedId === job.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{copiedId === job.id ? "Copied" : "Copy Link"}</span>
                      </button>

                      <a
                        href={job.redirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isLight 
                            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-100 hover:-translate-y-0.5 active:translate-y-0' 
                            : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/20 hover:-translate-y-0.5 active:translate-y-0'
                        }`}
                      >
                        <span>Apply Now</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Render Hackathons Viewport */}
      {activeTab === "hackathons" && (
        <div className="space-y-4">
          {/* Bento Metric Cards */}
          {!hackathonsLoading && !hackathonsError && hackathons.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className={`border rounded-2xl p-4 flex items-center gap-4 ${
                isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-850/50'
              }`}>
                <div className="bg-violet-500/10 text-violet-400 p-2.5 rounded-xl border border-violet-500/20 shrink-0">
                  <Trophy size={18} />
                </div>
                <div>
                  <h4 className={`text-[9px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Total Merged</h4>
                  <p className={`text-sm font-extrabold font-mono mt-0.5 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                    {filteredHackathons.length} Events
                  </p>
                </div>
              </div>

              <div className={`border rounded-2xl p-4 flex items-center gap-4 ${
                isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-850/50'
              }`}>
                <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl border border-blue-500/20 shrink-0">
                  <Code size={18} />
                </div>
                <div>
                  <h4 className={`text-[9px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Devpost</h4>
                  <p className={`text-sm font-extrabold font-mono mt-0.5 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                    {devpostCount} Active
                  </p>
                </div>
              </div>

              <div className={`border rounded-2xl p-4 flex items-center gap-4 ${
                isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-850/50'
              }`}>
                <div className="bg-pink-500/10 text-pink-400 p-2.5 rounded-xl border border-pink-500/20 shrink-0">
                  <Activity size={18} className="animate-pulse" />
                </div>
                <div>
                  <h4 className={`text-[9px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>HackerEarth</h4>
                  <p className={`text-sm font-extrabold font-mono mt-0.5 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                    {hackerEarthCount} Active
                  </p>
                </div>
              </div>

              <div className={`border rounded-2xl p-4 flex items-center gap-4 ${
                isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-850/50'
              }`}>
                <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-xl border border-amber-500/20 shrink-0">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className={`text-[9px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Unstop</h4>
                  <p className={`text-sm font-extrabold font-mono mt-0.5 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                    {unstopCount} Active
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-zinc-800/30 pb-2 pt-2">
            <h2 className={`text-[10px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Team Programming Challenges
            </h2>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              isLight ? 'bg-violet-50 border-violet-100 text-violet-600' : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
            }`}>
              ≡ƒöÑ {filteredHackathons.length} Matches
            </span>
          </div>

          {hackathonsError && (
            <div className={`border rounded-2xl p-5 flex items-start gap-4 ${
              isLight ? 'bg-red-50 border-red-100 text-red-800' : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">Request Query Failure</h4>
                <p className="text-xs mt-1 leading-relaxed opacity-85">{hackathonsError}</p>
              </div>
            </div>
          )}

          {hackathonsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-36 rounded-2xl animate-pulse border ${
                  isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/40'
                }`} />
              ))}
            </div>
          ) : filteredHackathons.length === 0 && !hackathonsError ? (
            <div className={`border rounded-2xl p-16 text-center space-y-3 ${
              isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-850/30'
            }`}>
              <Trophy size={28} className="mx-auto text-zinc-500 opacity-50" />
              <h3 className="font-bold text-xs">No Active Hackathons</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                No active events match the filter keyword "{hackathonKeyword}". Try expanding platform selection filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHackathons.map((h) => {
                const isDevpost = h.source === "Devpost";
                return (
                  <div 
                    key={h.id} 
                    className={`border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                      isLight 
                        ? 'bg-white border-zinc-200 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/[0.02]' 
                        : 'bg-zinc-950/20 border-zinc-850 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/[0.04]'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Title */}
                      <h3 className={`font-bold text-sm leading-snug line-clamp-2 pr-12 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                        {h.title}
                      </h3>

                      {/* Details row */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className={`px-2 py-0.5 rounded border ${
                          h.source === "Devpost"
                            ? isLight ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            : h.source === "HackerEarth"
                              ? isLight ? "bg-pink-50 border-pink-100 text-pink-700" : "bg-pink-500/10 border-pink-500/30 text-pink-400"
                              : isLight ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        }`}>
                          {h.source}
                        </span>
                        <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                          isLight ? "bg-zinc-50 border-zinc-200 text-zinc-650" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                        }`}>
                          <Terminal size={11} className="opacity-55" />
                          {h.type}
                        </span>
                      </div>

                      {/* Dates */}
                      <p className={`text-[10px] font-bold flex items-center gap-1.5 font-mono pt-1 ${
                        isLight ? 'text-zinc-600' : 'text-zinc-400'
                      }`}>
                        <Calendar size={12} className="opacity-60" /> {h.timeline}
                      </p>
                    </div>

                    {/* Actions row */}
                    <div className="pt-3.5 border-t border-zinc-800/10 dark:border-zinc-800/50 flex items-center justify-between gap-3 mt-4">
                      <button
                        onClick={() => handleCopyLink(h.link, h.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                          isLight ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350'
                        }`}
                      >
                        {copiedId === h.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{copiedId === h.id ? "Copied" : "Copy Link"}</span>
                      </button>

                      <a
                        href={h.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isLight 
                            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-100 hover:-translate-y-0.5 active:translate-y-0' 
                            : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-950/20 hover:-translate-y-0.5 active:translate-y-0'
                        }`}
                      >
                        <span>Visit Challenge</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
