import {
  CareerRoadmap,
  DailyTask,
  QuizQuestion,
  UserProfile,
  HeroStory,
} from '../types';
// NOTE: @google/genai Node SDK is NOT used — we use direct REST fetch for browser/mobile compatibility
import { networkService } from "./networkService";
import { llamaPlugin } from "./llamaPlugin";
import { Capacitor } from '@capacitor/core';

const IS_NATIVE_MOBILE = Capacitor.isNativePlatform();

// Type schema enum (mirrors @google/genai Type, but works in browser)
const Type = {
  STRING: 'STRING' as const,
  NUMBER: 'NUMBER' as const,
  BOOLEAN: 'BOOLEAN' as const,
  OBJECT: 'OBJECT' as const,
  ARRAY: 'ARRAY' as const,
};

// API Keys - fall back to build-time .env
const getGoogleApiKey = (): string => import.meta.env.VITE_GEMINI_API_KEY || '';
const getOpenRouterApiKey = (): string => import.meta.env.VITE_OPENROUTER_API_KEY || '';
const getGroqApiKey = (): string => import.meta.env.VITE_GROQ_API_KEY || '';

// ── Helper: Direct REST call to Gemini generateContent API ──────────────────
async function callGeminiRest(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  contents?: any[],
  responseMimeType?: string,
  temperature?: number,
  responseSchema?: any
): Promise<string> {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const reqContents: any[] = contents && contents.length > 0
    ? contents
    : [{ role: 'user', parts: [{ text: prompt }] }];

  const body: any = { contents: reqContents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const genConfig: any = {};
  if (responseMimeType) genConfig.responseMimeType = responseMimeType;
  if (temperature !== undefined) genConfig.temperature = temperature;
  if (responseSchema) genConfig.responseSchema = responseSchema;
  if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini REST error ${res.status}: ${errText.substring(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini REST returned empty response');
  return text;
}

// Helper to repair/extract JSON from model outputs
function tryParseJson(text: string): any {
  const cleanText = text.trim();
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    const startObj = cleanText.indexOf('{');
    const endObj = cleanText.lastIndexOf('}');
    if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(cleanText.substring(startObj, endObj + 1));
      } catch (inner) {}
    }
    const startArr = cleanText.indexOf('[');
    const endArr = cleanText.lastIndexOf(']');
    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
      try {
        return JSON.parse(cleanText.substring(startArr, endArr + 1));
      } catch (inner) {}
    }
    throw e;
  }
}

// Helper to normalize career paths to a standard schema
export const normalizeCareers = (data: any[]): any[] => {
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => {
    const dream = item.dream || item.title || item.name || item.career || item.career_title || "";
    const description = item.description || item.summary || item.desc || `A rewarding career path in ${dream}.`;
    let subjects = item.subjects || item.skills || item.tags || item.key_subjects || [];
    if (typeof subjects === 'string') {
      subjects = subjects.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return {
      dream: String(dream).trim(),
      description: String(description).trim(),
      subjects: Array.isArray(subjects) ? subjects.slice(0, 3) : []
    };
  }).filter(c => c.dream);
};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  PRIMARY: Local AI Backend (Crawl4AI + Ollama Gemma4 (gemma4:e4b))
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000';
  }
  return '';
};

//  CENTRAL ROUTING LLM GENERATOR (Google -> OpenRouter -> Groq -> Local)
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface LLMRequestOptions {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  contents?: any[];
  useSearch?: boolean;
}

export const generateText = async (options: LLMRequestOptions): Promise<string> => {
  await networkService.ready();
  const isOnline = networkService.isOnline();
  
  if (isOnline) {
    // 1. Google Gemini (Primary) — direct REST fetch (no Node SDK required)
    const googleKey = getGoogleApiKey();
    if (googleKey) {
      try {
        console.log('[LLMRouter] Trying Google Gemini REST API...');
        const extractedText = await callGeminiRest(
          googleKey,
          options.prompt,
          options.systemInstruction,
          options.contents,
          options.responseMimeType,
          options.temperature,
          options.responseSchema
        );
        if (extractedText) {
          console.log('[LLMRouter] Google Gemini succeeded.');
          return extractedText;
        }
      } catch (e: any) {
        const errMsg = String(e?.message || e);
        console.warn(`[LLMRouter] Google Gemini failed. Trying OpenRouter...`, errMsg.substring(0, 200));
      }
    }
    
    // 2. OpenRouter (Secondary)
    const openRouterKey = getOpenRouterApiKey();
    if (openRouterKey) try {
      console.log("[LLMRouter] Trying OpenRouter API...");
      const messages: any[] = [];
      if (options.systemInstruction) {
        messages.push({ role: "system", content: options.systemInstruction });
      }
      
      if (options.contents) {
        options.contents.forEach((item: any) => {
          const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
          let text = '';
          if (Array.isArray(item.parts)) {
            item.parts.forEach((p: any) => {
              if (p.text) text += p.text;
            });
          } else if (typeof item.parts === 'string') {
            text = item.parts;
          } else if (item.content) {
            text = item.content;
          }
          messages.push({ role, content: text });
        });
      } else {
        messages.push({ role: "user", content: options.prompt });
      }
      
      const body: any = {
        model: "openrouter/auto",
        messages,
        temperature: options.temperature ?? 0.3,
      };
      
      if (options.responseMimeType === "application/json") {
        body.response_format = { type: "json_object" };
      }
      
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://kalam-spark.com",
          "X-Title": "Kalam Spark"
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          console.log("[LLMRouter] OpenRouter succeeded.");
          return text;
        }
      }
    } catch (e: any) {
      console.warn("[LLMRouter] OpenRouter failed. Trying Groq...", e?.message);
    }
    
    // 3. Groq (Tertiary)
    const groqKey = getGroqApiKey();
    if (groqKey) try {
      console.log("[LLMRouter] Trying Groq API...");
      const messages: any[] = [];
      if (options.systemInstruction) {
        messages.push({ role: "system", content: options.systemInstruction });
      }
      
      if (options.contents) {
        options.contents.forEach((item: any) => {
          const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
          let text = '';
          if (Array.isArray(item.parts)) {
            item.parts.forEach((p: any) => {
              if (p.text) text += p.text;
            });
          } else if (typeof item.parts === 'string') {
            text = item.parts;
          } else if (item.content) {
            text = item.content;
          }
          messages.push({ role, content: text });
        });
      } else {
        messages.push({ role: "user", content: options.prompt });
      }
      
      const body: any = {
        model: "llama-3.1-8b-instant",
        messages,
        temperature: options.temperature ?? 0.3,
      };
      
      if (options.responseMimeType === "application/json") {
        body.response_format = { type: "json_object" };
      }
      
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          console.log("[LLMRouter] Groq succeeded.");
          return text;
        }
      }
    } catch (e: any) {
      console.warn("[LLMRouter] Groq failed.", e?.message);
    }
    
    throw new Error("Online AI generation failed. Please check your internet connection or backend keys.");
  } else {
    // 4. Local Gemma quantized model fallback (Offline only)
    if (llamaPlugin.isSupported()) {
      console.log("[LLMRouter] Device is offline. Calling local model...");
      const text = await llamaPlugin.getCompletion(options.prompt, options.systemInstruction);
      if (text) {
        return text;
      }
    }
    throw new Error("Internet is unavailable, and no local offline model is loaded. Please connect to the internet.");
  }
};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  EXPOSED SERVICE FUNCTIONS
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export const generateRoadmap = async (
  profile: UserProfile,
): Promise<CareerRoadmap> => {
  await networkService.ready();

  if (!networkService.isOnline()) {
    throw new Error("📡 No Internet Connection — Connecting to the internet is required to generate or refresh your career roadmap.");
  }

  const isOnline = networkService.isOnline();
  const backendUrl = getBackendUrl();

  // Career disambiguation mapping
  const dreamClean = (profile.dream || "").trim().toLowerCase();
  let normalizedDream = profile.dream || "";
  const disambiguation: Record<string, string> = {
    "doctor": "Medical Doctor (Physician)",
    "medical doctor": "Medical Doctor (Physician)",
    "gp": "General Practitioner (Medical Doctor)",
    "physician": "Medical Doctor (Physician)",
    "surgeon": "General Surgeon (Medical Doctor)",
    "dentist": "Dentist (Dental Surgeon)",
    "nurse": "Registered Nurse (Healthcare)",
    "lawyer": "Lawyer (Attorney/Legal Practitioner)",
    "advocate": "Advocate (Legal Practitioner)",
  };
  if (dreamClean in disambiguation) {
    normalizedDream = disambiguation[dreamClean];
  }

  // 1. Try local FastAPI backend first
  if (backendUrl) {
    try {
      console.log("[generateRoadmap] Trying local backend...");
      const response = await fetch(`${backendUrl}/api/roadmap?dream=${encodeURIComponent(normalizedDream)}&year=${encodeURIComponent(profile.year || '')}&branch=${encodeURIComponent(profile.branch || '')}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.stages && data.stages.length > 0) {
          console.log("[generateRoadmap] Local backend succeeded.");
          // Normalize stages structure
          data.stages = data.stages.map((s: any, i: number) => ({
            id: s.id || `stage-${i + 1}`,
            title: s.title || `Stage ${i + 1}`,
            description: s.description || `In this stage, you will focus on foundational concepts of ${profile.dream}.`,
            duration: s.duration || '8-12 weeks',
            subjects: Array.isArray(s.subjects) ? s.subjects : [],
            concepts: Array.isArray(s.concepts) ? s.concepts : (Array.isArray(s.subjects) ? s.subjects : []),
            skills: Array.isArray(s.skills) ? s.skills : [],
            projects: Array.isArray(s.projects) ? s.projects : [],
            resources: Array.isArray(s.resources) ? s.resources : []
          }));
          return data as CareerRoadmap;
        }
      } else {
        console.warn(`[generateRoadmap] Local backend error HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (backendErr) {
      console.warn("[generateRoadmap] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  try {
    const language = localStorage.getItem('kalam_spark_lang') || 'en';
    const systemInstruction = `You are an elite career mentor. Return ONLY a raw JSON object matching the requested schema. Do NOT wrap in markdown.
    
    Roadmap Schema:
    {
      "dream": "Career title",
      "summary": "Exactly 2 complete sentences: sentence 1 describes what this career is and what the student will do; sentence 2 states what they will achieve by following this roadmap. Be specific and inspiring. No more than 40 words total.",
      "stages": [
        {
          "id": "stage-1",
          "title": "Stage 1 Title (specific to career)",
          "description": "Comprehensive explanation of what to learn and why in this stage.",
          "duration": "8-12 weeks",
          "subjects": ["Specific Course 1", "Specific Course 2", "Specific Course 3"],
          "concepts": ["Concept/Skill Check 1", "Concept/Skill Check 2", "Concept/Skill Check 3"],
          "skills": ["Skill 1", "Skill 2", "Skill 3"],
          "projects": ["Project idea 1", "Project idea 2"],
          "resources": []
        }
      ]
    }`;

    const prompt = `Create a detailed 6-stage career roadmap for a student whose dream career is to become a ${normalizedDream}.
    
STUDENT PROFILE:
- Dream Career: ${normalizedDream}
- Education Stage: ${profile.educationLevel} (school, college, graduate, or self-learner)
- Current Year / Class / Semester: ${profile.year}
- Current Field/Branch of Study: ${profile.branch}
- School Board (if school): ${profile.schoolBoard || 'Not applicable'}
- School or College Name: ${profile.collegeName || 'Not specified'}
- Extra Academic Background / Strengths: ${profile.motivation || 'None'}

REQUIREMENTS:
1. Generate EXACTLY 6 progressive stages from their current level (${profile.year} in ${profile.branch}) to successfully landing a role as a ${normalizedDream}.
2. TAILOR THE ROADMAP STAGES & FOUNDATION TO THEIR CURRENT EDUCATIONAL STAGE:
   - If the student is in SCHOOL (e.g., Class 1-12):
     - Stage 1 and Stage 2 MUST focus on building the correct foundation within their current class and school subjects. Specify exactly which school subjects (e.g., Mathematics, Physics, Chemistry, English, etc.) they need to be strong in at their current class level (${profile.year}) and what foundational concepts they must master to eventually achieve their dream career.
     - Include advice on how to align their school studies (CBSE, State Board, etc.) with their dream career.
   - If the student is in COLLEGE (Under-Graduate or Post-Graduate):
     - Tailor the early stages to their specific degree, year, and semester (${profile.year}). Specify the exact college subjects, core academic courses, and university projects they should focus on to align with their dream career.
     - If their college major/branch (${profile.branch}) is different from their dream career, specify how they should balance their college curriculum while self-studying or transitioning/pivoting in the early stages.
   - If the student is a SELF-LEARNER / WORKING professional:
     - Focus the first stages on leveraging their existing skills and bridging the gap between their current background and the skills required for the dream career.
3. Ensure the roadmap is highly accurate and practical for ${normalizedDream}.
   - Focus on Target Career: Base the roadmap stages, subjects, concepts, and skills strictly on the target dream career (${normalizedDream}). If the target career is unrelated to their current branch of study (${profile.branch}), do NOT include subjects, tools, or concepts from ${profile.branch}. Focus exclusively on the requirements of the target career ${normalizedDream}.
   - Note on terminology: If the target career is 'Doctor', 'Physician', or a medical practitioner, this refers EXCLUSIVELY to a medical doctor (e.g., MBBS, MD, DO) practicing medicine. Under no circumstances should you generate an academic PhD or academic doctoral program roadmap unless the career is explicitly specified as a PhD/academic doctorate.
   - Cross-Disciplinary Transition handling: If the student is transitioning from an unrelated current field/branch (e.g. Mathematics, Computer Science, AI, Engineering) to a completely different field (e.g. Medicine/Doctor, Law, Creative Arts), the roadmap MUST focus on the transition/pivot process in the early stages.
4. Each stage MUST have:
   - Minimum 10 highly specific subjects/topics (e.g., "Organic Chemistry", "Linear Algebra", "Pediatric Medicine" ΓÇö do NOT use generic titles like "Chemistry" or "Core Concepts").
   - 4-6 specific learnable items/concepts in the 'concepts' array that map directly to checkboxes for student progress (e.g., "Learn vector spaces", "Identify anatomic structures").
   - 6 skills, 3 projects, 100+ word description.
5. Use real professional tools, technologies, methodologies, and frameworks specific to ${normalizedDream}.
6. Realistic durations for a student at the ${profile.year} level to transition. Language: ${language}`;

    const resText = await generateText({
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dream: { type: Type.STRING },
          summary: { type: Type.STRING },
          stages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                duration: { type: Type.STRING },
                subjects: { type: Type.ARRAY, items: { type: Type.STRING } },
                concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } },
                resources: { type: Type.ARRAY, items: { type: Type.OBJECT } }
              },
              required: ["id", "title", "description", "duration", "subjects", "concepts", "skills", "projects"]
            }
          }
        },
        required: ["dream", "summary", "stages"]
      }
    });

    const data = tryParseJson(resText || "{}");
    if (data && data.stages && data.stages.length > 0) {
      // Normalize stages structure
      data.stages = data.stages.map((s: any, i: number) => ({
        id: s.id || `stage-${i + 1}`,
        title: s.title || `Stage ${i + 1}`,
        description: s.description || `In this stage, you will focus on foundational concepts of ${profile.dream}.`,
        duration: s.duration || '8-12 weeks',
        subjects: Array.isArray(s.subjects) ? s.subjects : [],
        concepts: Array.isArray(s.concepts) ? s.concepts : (Array.isArray(s.subjects) ? s.subjects : []),
        skills: Array.isArray(s.skills) ? s.skills : [],
        projects: Array.isArray(s.projects) ? s.projects : [],
        resources: Array.isArray(s.resources) ? s.resources : []
      }));
      return data as CareerRoadmap;
    }
  } catch (e) {
    console.error("[generateRoadmap] Failed:", e);
  }

  console.log("[generateRoadmap] All LLM routes failed. Cannot generate roadmap offline without a loaded model.");
  throw new Error("Could not generate roadmap. Please connect to the internet or load a local Gemma 4 model (.gguf) file in settings to generate roadmaps offline.");
};

export const discoverDream = async (interests: string[], personality: string[]): Promise<any[]> => {
  await networkService.ready();

  const isOnline = networkService.isOnline();
  const backendUrl = getBackendUrl();

  if (backendUrl) {
    try {
      console.log("[discoverDream] Trying local backend...");
      const language = localStorage.getItem('kalam_spark_lang') || 'en';
      const response = await fetch(`${backendUrl}/api/discover_dream?interests=${encodeURIComponent(interests.join(','))}&personality=${encodeURIComponent(personality.join(','))}&language=${encodeURIComponent(language)}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log("[discoverDream] Local backend succeeded.");
          return normalizeCareers(data);
        }
      } else {
        console.warn(`[discoverDream] Local backend error HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (backendErr) {
      console.warn("[discoverDream] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  try {
    const resText = await generateText({
      prompt: `Suggest exactly 12 ideal career paths for a student with interests: ${interests.join(", ")} and personality: ${personality.join(", ")}.
Make sure each career title in 'dream' is a concise job/career title (e.g. 'Software Engineer', 'Robotics Engineer', 'Patent Lawyer') and NOT a long description. Describe what the career involves in the separate 'description' field.`,
      systemInstruction: "You are an expert career counselor. Return ONLY a JSON array of exactly 12 objects. Do NOT wrap in markdown.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dream: { type: Type.STRING },
            description: { type: Type.STRING },
            subjects: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["dream", "description", "subjects"]
        }
      }
    });

    const data = tryParseJson(resText || "[]");
    if (Array.isArray(data) && data.length > 0) return normalizeCareers(data);
  } catch (e) {
    console.error("Dream discovery failed:", e);
  }

  return normalizeCareers([
    { dream: 'Software Engineer', description: 'Design and build software applications and systems using code.', subjects: ['Computer Science', 'Logic', 'Mathematics'] },
    { dream: 'Data Scientist', description: 'Analyze complex data sets to discover patterns and drive decision-making.', subjects: ['Statistics', 'Python', 'Analysis'] },
    { dream: 'UI/UX Designer', description: 'Create intuitive and visually appealing user interfaces and experiences.', subjects: ['Design', 'Psychology', 'Prototyping'] },
    { dream: 'Product Manager', description: 'Lead the product lifecycle from conception to launch, aligning business goals.', subjects: ['Business', 'Leadership', 'Communication'] },
    { dream: 'Cybersecurity Specialist', description: 'Protect an organization\'s systems, networks, and data from digital attacks.', subjects: ['Networking', 'Security', 'Problem Solving'] },
    { dream: 'Digital Marketer', description: 'Promote products or brands using digital channels and marketing strategies.', subjects: ['SEO', 'Content', 'Analytics'] },
    { dream: 'Cloud Architect', description: 'Design and manage cloud computing architecture and infrastructure.', subjects: ['Infrastructure', 'DevOps', 'Cloud Computing'] },
    { dream: 'Research Scientist', description: 'Conduct experiments and analyze research data to discover new knowledge.', subjects: ['Physics', 'Methods', 'Documentation'] },
    { dream: 'AI Engineer', description: 'Build intelligent systems and models using machine learning algorithms.', subjects: ['Machine Learning', 'AI', 'Neural Networks'] },
    { dream: 'Business Analyst', description: 'Analyze business processes and requirements to improve efficiency.', subjects: ['Data', 'Finance', 'Strategy'] },
    { dream: 'Content Creator', description: 'Produce engaging digital content across video, audio, and text platforms.', subjects: ['Storytelling', 'Video Editing', 'Social Media'] },
    { dream: 'Financial Analyst', description: 'Evaluate financial data and trends to guide business investment decisions.', subjects: ['Accounting', 'Investment', 'Excel'] }
  ]);
};

export const getHeroStory = async (dream: string): Promise<HeroStory> => {
  try {
    const resText = await generateText({
      prompt: `Tell a very short, exciting story of a real person who became a successful ${dream}. Use simple English for kids. Return JSON with name, role, achievement, summary.`,
      systemInstruction: "You are a storyteller. Return ONLY valid raw JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          achievement: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["name", "role", "achievement", "summary"],
      }
    });
    return tryParseJson(resText || "{}");
  } catch (e) {
    console.error("Hero story failed:", e);
  }

  return {
    name: "A Big Dreamer",
    role: dream,
    achievement: "Success",
    summary: "They worked hard and reached their goal!",
  };
};

export const getDynamicResources = async (
  profile: UserProfile,
  stage: any,
): Promise<any> => {
  const systemInstruction = `You are Dream Mentor AI. Your task is to recommend REAL educational resources.
  
  USER PROFILE:
  - Dream: ${profile.dream}
  - Current Topic: ${stage.title}
  - Focus Skills: ${(stage.skills || []).join(", ")}
  - Level: ${profile.year}

  STRICT REQUIREMENTS:
  1. VIDEOS: Recommend real, popular YouTube videos/channels. Use realistic YouTube links (https://www.youtube.com/watch?v=...).
  2. BOOKS: Recommend real books on Google Books (https://books.google.com/books?id=...).
  3. NEWS: Recommend realistic industry news articles.
  
  Return at least 2-3 items per category in JSON matching schema:
  {
    "books": [{"title": "Book Title", "category": "General", "summary": "Brief summary", "link": "https://books.google.com..."}],
    "videos": [{"title": "Video Title", "category": "Tutorial", "summary": "Brief summary", "link": "https://www.youtube.com..."}],
    "news": [{"title": "News Title", "summary": "Brief summary", "link": "https://example.com..."}]
  }`;

  try {
    const prompt = `Recommend high-quality YouTube lectures, Google Books, and recent industry news for a ${profile.year} student learning "${stage.title}" to become a ${profile.dream}.`;
    const resText = await generateText({
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          books: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                summary: { type: Type.STRING },
                link: { type: Type.STRING },
              },
              required: ["title", "link", "summary"],
            },
          },
          videos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                summary: { type: Type.STRING },
                link: { type: Type.STRING },
              },
              required: ["title", "link", "summary"],
            },
          },
          news: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                link: { type: Type.STRING },
              },
              required: ["title", "link", "summary"],
            },
          },
        },
      }
    });
    return tryParseJson(resText || "{}");
  } catch (e) {
    console.error("Resource fetch error:", e);
  }

  return { books: [], videos: [], news: [] };
};

const OFFLINE_QUOTES = [
  "The expert in anything was once a beginner. Start today.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "Your limitationΓÇöit's only your imagination.",
  "Dream big, start small, act now.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "Don't watch the clock; do what it does. Keep going.",
  "Every champion was once a contender that refused to give up."
];

export const getMotivationalQuote = async (dream: string): Promise<string> => {
  const isOnline = networkService.isOnline();
  
  if (!isOnline) {
    // Return a constant quote from the offline list when offline
    const randomIdx = Math.floor(Math.random() * OFFLINE_QUOTES.length);
    return OFFLINE_QUOTES[randomIdx];
  }

  // Check cache for online quotes (change after 3 days)
  try {
    const cachedQuote = localStorage.getItem('kalamspark_cached_quote');
    const cachedTimeStr = localStorage.getItem('kalamspark_cached_quote_time');
    
    if (cachedQuote && cachedTimeStr) {
      const cachedTime = parseInt(cachedTimeStr, 10);
      const now = Date.now();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      
      if (now - cachedTime < threeDaysMs) {
        return cachedQuote;
      }
    }
  } catch (err) {
    console.warn("[getMotivationalQuote] Failed to read quote from cache", err);
  }

  // Cache is invalid or doesn't exist, fetch a new one online
  try {
    const prompt = `A short motivational quote for a student who wants to be a ${dream}. Return only the quote.`;
    const newQuote = await generateText({
      prompt,
      systemInstruction: "You are a motivational mentor. Keep it under 15 words."
    });
    
    if (newQuote && newQuote.trim()) {
      const trimmed = newQuote.trim().replace(/^["']|["']$/g, ''); // strip outer quotes if any
      try {
        localStorage.setItem('kalamspark_cached_quote', trimmed);
        localStorage.setItem('kalamspark_cached_quote_time', Date.now().toString());
      } catch (err) {
        console.warn("[getMotivationalQuote] Failed to save quote to cache", err);
      }
      return trimmed;
    }
  } catch (e) {
    console.error("Quote fetch error:", e);
  }

  // Fallback if online API call fails
  const fallbackIdx = Math.floor(Math.random() * OFFLINE_QUOTES.length);
  return OFFLINE_QUOTES[fallbackIdx];
};

export const getCareerNews = async (dream: string): Promise<any[]> => {
  const isOnline = networkService.isOnline();
  if (isOnline) {
    try {
      const prompt = `Provide 3 realistic and exciting current updates/achievements happening in the field of ${dream}. Format your output as a raw JSON array: [{"title": "Title of update", "link": "https://example.com/news", "summary": "Brief description"}].`;
      const systemInstruction = "You are a news reporter. Return ONLY a valid JSON array.";
      const resText = await generateText({ prompt, systemInstruction, responseMimeType: "application/json" });
      const parsed = tryParseJson(resText);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error("News generation failed:", e);
    }
  }
  return [];
};

export const generateMicroQuiz = async (
  subject: string,
  tasks: string[] = [],
  stageDetails?: { description?: string; concepts?: string[] },
  completedTasks: string[] = [],   // today's COMPLETED task titles ΓÇö quiz is based on these
  quizNumber: number = 1,          // 1 = foundational, 2 = intermediate, 3 = advanced, 4+ = expert
  previousQuestions: string[] = [] // questions already shown in earlier rounds ΓÇö LLM must NOT repeat
): Promise<QuizQuestion[]> => {
  await networkService.ready();

  // Escalating difficulty label based on quiz round number
  const difficultyLabel = quizNumber === 1 ? 'beginner/foundational'
    : quizNumber === 2 ? 'intermediate ΓÇö apply and analyze'
    : quizNumber === 3 ? 'advanced ΓÇö evaluate and synthesize'
    : 'expert ΓÇö deep-dive edge cases and real-world scenarios';

  // Quiz source is ONLY completed tasks (not all tasks)
  const quizSource = completedTasks.length > 0 ? completedTasks : tasks;

  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      console.log("[generateMicroQuiz] Trying local backend...");
      const response = await fetch(`${backendUrl}/api/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          tasks: quizSource,
          stage_description: stageDetails?.description || "",
          stage_concepts: stageDetails?.concepts || [],
          difficulty: difficultyLabel,
          quiz_number: quizNumber,
          previous_questions: previousQuestions || []
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log("[generateMicroQuiz] Local backend succeeded.");
          return data.slice(0, 10);
        }
      } else {
        console.warn(`[generateMicroQuiz] Local backend error HTTP ${response.status}`);
      }
    } catch (backendErr) {
      console.warn("[generateMicroQuiz] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  // ΓöÇΓöÇ 2. Gemini API fallback ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  try {
    const tasksBullet = quizSource.map(t => `- ${t}`).join('\n');

    // Build an exclusion block so Gemini cannot repeat any prior question
    const exclusionBlock = previousQuestions.length > 0
      ? `\n\nCRITICAL ΓÇö DO NOT generate any of these questions (already asked in earlier rounds):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\nGenerate COMPLETELY NEW questions that test DIFFERENT aspects of the tasks.`
      : '';

    const advancedNote = quizNumber > 1
      ? `\nThis is Quiz Round #${quizNumber}. Increase difficulty to "${difficultyLabel}". Go deeper and test real-world application, NOT surface-level recall.`
      : '';

    const prompt = `Generate a 10-question multiple choice quiz STRICTLY based on these completed tasks:

${tasksBullet}

Subject: ${subject}
Stage context: ${stageDetails?.description || ''}
Difficulty: ${difficultyLabel}
${advancedNote}
${exclusionBlock}

Rules:
- Every question MUST test knowledge from the completed tasks listed above
- Do NOT ask about topics not mentioned in those tasks
- Each question needs exactly 4 options
- correctAnswer is the 0-based index of the correct option
- Include a clear explanation for the correct answer
- Questions must test real understanding, NOT trivial memorization`;

    const systemInstruction = `You are a Lead Expert examiner. Generate quiz questions ONLY from the provided completed task list. Each question must be unique and not repeat any previously-shown question. Return ONLY a JSON array of 10 quiz questions. No markdown wrapping.`;

    const resText = await generateText({
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question:      { type: Type.STRING },
            options:       { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.NUMBER },
            explanation:   { type: Type.STRING },
          },
          required: ["question", "options", "correctAnswer", "explanation"],
        },
      }
    });

    const parsed = tryParseJson(resText || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 10);
  } catch (e) {
    console.error("[generateMicroQuiz] Gemini fallback failed:", e);
  }

  // No hardcoded fallback ΓÇö surface an actionable error to the user
  throw new Error(`Could not generate quiz. Please ensure you have completed some tasks today and are connected to the internet, then try again.`);
};

export const generateDreamSummary = async (dream: string, branch: string, year: string): Promise<string> => {
  const language = localStorage.getItem('kalam_spark_lang') || 'en';
  await networkService.ready();

  const isOnline = networkService.isOnline();
  const backendUrl = getBackendUrl();

  if (backendUrl) {
    try {
      console.log("[generateDreamSummary] Trying local backend...");
      const response = await fetch(`${backendUrl}/api/career_summary?dream=${encodeURIComponent(dream)}&branch=${encodeURIComponent(branch)}&year=${encodeURIComponent(year)}&language=${encodeURIComponent(language)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.summary) {
          console.log("[generateDreamSummary] Local backend succeeded.");
          return data.summary;
        }
      } else {
        console.warn(`[generateDreamSummary] Local backend error HTTP ${response.status}`);
      }
    } catch (backendErr) {
      console.warn("[generateDreamSummary] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  try {
    const prompt = `Write an inspiring career overview for a ${dream} (focusing on ${branch} for a ${year} student).`;
    const resText = await generateText({
      prompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentence1: { type: Type.STRING },
          sentence2: { type: Type.STRING },
          sentence3: { type: Type.STRING }
        },
        required: ["sentence1", "sentence2", "sentence3"]
      }
    });

    const parsed = tryParseJson(resText || "{}");
    if (parsed.sentence1 && parsed.sentence2 && parsed.sentence3) {
      let s1 = parsed.sentence1.trim();
      let s2 = parsed.sentence2.trim();
      let s3 = parsed.sentence3.trim();
      if (!s1.match(/[.!?]$/)) s1 += '.';
      if (!s2.match(/[.!?]$/)) s2 += '.';
      if (!s3.match(/[.!?]$/)) s3 += '.';
      return `${s1} ${s2} ${s3}`;
    }
  } catch (e) {
    console.error('generateDreamSummary failed:', e);
  }

  const dreamLower = dream.toLowerCase();
  if (dreamLower.includes('engineer') || dreamLower.includes('developer')) {
    return `A ${dream} designs and builds technical solutions that solve complex real-world problems through code and logic. You will spend your days writing high-quality code, debugging systems, and collaborating with teams on platforms like GitHub. Your main duties include architecting software features, optimizing performance, and ensuring system reliability.`;
  } else if (dreamLower.includes('doctor') || dreamLower.includes('health')) {
    return `A ${dream} is a dedicated healthcare provider who diagnoses illnesses and promotes wellness in their community. Your daily work involves clinical examinations, analyzing patient data, and coordinating care with other medical professionals. Your core responsibilities are accurate diagnosis, treatment planning, and patient education.`;
  } else if (dreamLower.includes('teacher') || dreamLower.includes('educator')) {
    return `A ${dream} shapes young minds by making complex subjects accessible, engaging, and deeply meaningful for students. Each day involves lesson planning, delivering dynamic classes, grading assignments, and providing individualized support. Their core responsibilities include curriculum design, student assessment, and fostering a positive classroom environment.`;
  } else {
    return `A ${dream} is a specialized professional who applies expert knowledge in ${branch} to drive innovation and impact every single day. Their daily work involves using industry-standard tools to solve unique challenges and collaborating with diverse teams to achieve project goals. Their core responsibilities include strategic planning, execution of critical tasks, and delivering high-quality, professional results.`;
  }
};



export const fetchDetailedCareerDescription = async (dream: string) => {
  await networkService.ready();
  const isOnline = networkService.isOnline();

  if (!isOnline) {
    throw new Error("No Internet Connection — Connecting to the internet is required to generate a fresh detailed career description.");
  }

  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      console.log('[fetchDetailedCareerDescription] Trying local backend...');
      const response = await fetch(`${backendUrl}/api/career_description?dream=${encodeURIComponent(dream)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.overview) {
          console.log('[fetchDetailedCareerDescription] Local backend succeeded.');
          return { ...data, career: dream };
        }
      }
    } catch (backendErr) {
      console.warn('[fetchDetailedCareerDescription] Local backend unreachable, trying direct Gemini REST:', backendErr);
    }
  }

  // Try online AI generation
  try {
    const prompt = `Provide a detailed career description for a ${dream}. Return a JSON object with: overview (string), roles (array of strings), required_skills (array of strings), market_outlook (string), salary_range (string), growth (string), tips (string).`;
    const systemInstruction = 'You are an elite career guidance counselor. Return ONLY a valid JSON object. No markdown.';
    const resText = await generateText({ prompt, systemInstruction, responseMimeType: 'application/json' });
    const parsed = tryParseJson(resText);
    if (parsed && parsed.overview) {
      return { ...parsed, career: dream, is_curated: false };
    }
  } catch (e: any) {
    console.error('Failed to generate detailed career description via AI:', e);
    throw new Error(e.message || "Failed to generate detailed career description via AI.");
  }

  throw new Error("Could not fetch detailed career description. Please verify connection and try again.");
};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  NEW CENTRAL FUNCTIONS FOR REACT VIEWS (ROUTER ROUTING)
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export const generateOpportunities = async (
  dream: string,
  branch: string,
  year: string,
  currentSkills: string
): Promise<any[]> => {

  const prompt = `Generate 6 relevant job/internship opportunities for a student who wants to become a "${dream}" in "${branch || 'General'}". They are a ${year} with skills: ${currentSkills}. Focus on the Indian job market (Internshala, LinkedIn, Naukri, Unstop, SIH).`;
  const systemInstruction = `You are a career advisor. Return ONLY a JSON array of 6 opportunity objects. Each must have: type (Internship|Job|Hackathon|Freelance|Fellowship), title, company, location, requiredSkills (string array of 3 skills), matchPercentage (number 70-95), actionText (e.g. "Apply on Internshala"), searchUrl (real platform URL with search query), platform. No markdown.`;
  
  try {
    const resText = await generateText({
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            matchPercentage: { type: Type.NUMBER },
            actionText: { type: Type.STRING },
            searchUrl: { type: Type.STRING },
            platform: { type: Type.STRING },
          },
          required: ["type", "title", "company", "location", "requiredSkills", "matchPercentage", "actionText", "searchUrl", "platform"]
        }
      }
    });
    const parsed = tryParseJson(resText);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error("[geminiService] generateOpportunities failed:", e);
  }
  throw new Error("Could not generate opportunities. Showing curated suggestions.");
};

export const generatePlannerTasks = async (
  dream: string,
  topic: string,
  subjects: string[],
  neededTasks: number
): Promise<any[]> => {
  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      console.log("[generatePlannerTasks] Trying local backend...");
      const response = await fetch(`${backendUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dream,
          current_stage: topic,
          subjects,
          count: neededTasks
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log("[generatePlannerTasks] Local backend succeeded.");
          return data;
        }
      } else {
        console.warn(`[generatePlannerTasks] Local backend error HTTP ${response.status}`);
      }
    } catch (backendErr) {
      console.warn("[generatePlannerTasks] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  const prompt = `Create exactly ${neededTasks} diverse, actionable daily tasks for a student studying to become a ${dream}, currently at stage: '${topic}'.
Their current topics: ${subjects.join(", ")}.

Rules:
- Each task "type" MUST be one of these four values ONLY: "theory", "hands-on", "review", "current-affairs"
- "theory": reading chapters, studying concepts, watching lectures
- "hands-on": building projects, practicing exercises, coding challenges, implementing tools
- "review": revising notes, summarizing a topic, taking a practice test, quizzing yourself
- "current-affairs": reading recent news or trends in the field (use sparingly, only 1 per batch)
- Include a balanced MIX: roughly 40% theory, 40% hands-on, 20% review
- Titles must be specific and mention the actual topic (not generic like "Read about...")
- Example good titles: "Implement a binary search tree in Python", "Read Chapter 3 of CLRS on Sorting Algorithms", "Summarize key differences between REST and GraphQL"`;
  const systemInstruction = `You are an expert educator creating a daily study plan. Return ONLY a valid JSON array of exactly ${neededTasks} tasks. No markdown. Each task must have: title (string, specific and actionable) and type (MUST be one of: "theory", "hands-on", "review", "current-affairs").`;
  
  try {
    const resText = await generateText({
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["title", "type"]
        }
      }
    });
    const parsed = tryParseJson(resText);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.error("[geminiService] generatePlannerTasks failed:", e);
  }
  return [];
};

export interface PivotResult {
  transferPercentage: number;
  transferableSkills: string[];
  biggestGap: string;
  marketDemand: string;
  timeToTransition: string;
  bridgePlan: { title: string; action: string }[];
}

export const analyzeCareerPivot = async (
  currentDream: string,
  newDream: string,
  branch: string,
  year: string,
  currentSkills: string
): Promise<PivotResult> => {
  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      console.log("[analyzeCareerPivot] Trying local backend...");
      const response = await fetch(`${backendUrl}/api/pivot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_dream: currentDream,
          new_dream: newDream,
          branch,
          year,
          current_skills: currentSkills
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.transferPercentage !== undefined && Array.isArray(data.bridgePlan)) {
          console.log("[analyzeCareerPivot] Local backend succeeded.");
          return data as PivotResult;
        }
      } else {
        console.warn(`[analyzeCareerPivot] Local backend error HTTP ${response.status}`);
      }
    } catch (backendErr) {
      console.warn("[analyzeCareerPivot] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  const prompt = `A student wants to pivot from ${currentDream} to ${newDream}. Branch: ${branch}, Skills: ${currentSkills}.`;
  const systemInstruction = `You are a Career Transition Architect. Return ONLY a valid JSON object matching the requested schema. Do NOT wrap in markdown.`;
  
  try {
    const resText = await generateText({
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transferPercentage: { type: Type.NUMBER },
          transferableSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          biggestGap: { type: Type.STRING },
          marketDemand: { type: Type.STRING },
          timeToTransition: { type: Type.STRING },
          bridgePlan: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                action: { type: Type.STRING }
              },
              required: ["title", "action"]
            }
          }
        },
        required: ["transferPercentage", "transferableSkills", "biggestGap", "marketDemand", "timeToTransition", "bridgePlan"]
      }
    });
    const parsed = tryParseJson(resText);
    if (parsed && parsed.transferPercentage !== undefined && Array.isArray(parsed.bridgePlan)) {
      return parsed as PivotResult;
    }
  } catch (e) {
    console.error("[geminiService] analyzeCareerPivot failed:", e);
  }
  
  return {
    transferPercentage: 45,
    transferableSkills: ["Problem Solving", "Research Skills", "Self-Learning"],
    biggestGap: `Transitioning from ${currentDream} to ${newDream} requires specialized domain knowledge.`,
    marketDemand: `${newDream} roles are growing with increasing demand.`,
    timeToTransition: "6-12 months with consistent effort",
    bridgePlan: [
      { title: "Foundation Learning", action: `Start with free courses covering core concepts of ${newDream}.` },
      { title: "Build Projects", action: `Create 2-3 portfolio projects demonstrating ${newDream} skills.` },
      { title: "Network & Apply", action: `Join communities on LinkedIn, attend meetups, and apply for internships.` }
    ]
  };
};

export const summarizeWebpage = async (
  url: string,
  content?: string
): Promise<string> => {
  const prompt = content
    ? `Extract and summarize the key content from this webpage. URL: ${url}\n\nPage HTML/content:\n${content}`
    : `You are given a URL: ${url}. Based on the URL pattern and your knowledge, describe what this page is about and extract any meaningful content you can infer.`;
  const systemInstruction = 'You are a web content extractor. Extract and present the main educational content from the given page. Be comprehensive. Output plain text only.';
  
  try {
    return await generateText({
      prompt,
      systemInstruction,
      temperature: 0.1
    });
  } catch (e) {
    console.error("[geminiService] summarizeWebpage failed:", e);
    return "";
  }
};

export const askDocumentRag = async (
  question: string,
  contextText: string,
  history: any[]
): Promise<string> => {
  const systemInstruction = `You are Kalam Spark Document Intelligence Agent.
You answer questions based on the provided documents.
Be extremely accurate, helpful, and concise (under 3 paragraphs).
Never make up facts not mentioned in the documents.`;

  const contents: any[] = [];
  history.forEach(h => {
    contents.push({
      role: h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: h.text }]
    });
  });
  contents.push({
    role: 'user',
    parts: [{ text: `Here are the documents:\n\n${contextText}\n\nQuestion: ${question}` }]
  });

  try {
    return await generateText({
      prompt: `Here are the documents:\n\n${contextText}\n\nQuestion: ${question}`,
      systemInstruction,
      temperature: 0.2,
      contents
    });
  } catch (e) {
    console.error("[geminiService] askDocumentRag failed:", e);
    return "";
  }
};

export const transformDocument = async (
  label: string,
  key: string,
  sourceText: string
): Promise<string> => {
  const systemInstruction = `You are a professional research assistant. Perform the requested transformation on the text. Return only the transformed result. No markdown packaging.`;
  const prompt = `Perform "${label}" (${key}) transformation on this document:\n\n${sourceText}`;
  
  try {
    return await generateText({
      prompt,
      systemInstruction,
      temperature: 0.3
    });
  } catch (e) {
    console.error("[geminiService] transformDocument failed:", e);
    return "";
  }
};

export const getMentorChatReply = async (
  userText: string,
  messages: any[],
  attachment?: any,
  userProfile?: any
): Promise<string> => {
  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      console.log("[getMentorChatReply] Trying local backend...");
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            name: userProfile?.name || 'Student',
            dream: userProfile?.dream || 'a great career',
            year: userProfile?.year || 'student',
            branch: userProfile?.branch || 'general studies',
            currentStageIndex: userProfile?.currentStageIndex || 0,
          },
          messages: messages.map(m => ({ role: m.role, text: m.text })),
          new_message: userText,
          attachment_base64: attachment?.base64 || "",
          attachment_type: attachment?.mimeType || "",
          language: localStorage.getItem('kalam_spark_lang') || 'en'
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.reply) {
          console.log("[getMentorChatReply] Local backend succeeded.");
          return data.reply;
        }
      } else {
        console.warn(`[getMentorChatReply] Local backend error HTTP ${response.status}`);
      }
    } catch (backendErr) {
      console.warn("[getMentorChatReply] Local backend unreachable/failed, falling back to direct browser APIs:", backendErr);
    }
  }

  const systemInstruction = `You are Kalam Spark, a friendly and encouraging AI career mentor.
Student: ${userProfile?.name || 'Student'}, Dream: ${userProfile?.dream || 'a great career'}, Education: ${userProfile?.year || 'student'}, Branch: ${userProfile?.branch || 'general studies'}, Stage: ${(userProfile?.currentStageIndex || 0) + 1}.

- Be warm and supportive. 
- Respond NATURALLY to simple greetings (say hello back - do NOT generate a huge roadmap).
- Keep responses focused and practical (2-3 paragraphs max).
- Never use markdown headers. Use **bold** for emphasis.`;

  const contents: any[] = [];
  messages.slice(1).forEach(m => {
    contents.push({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }]
    });
  });

  const userParts: any[] = [{ text: userText }];
  if (attachment && attachment.base64) {
    if (attachment.mimeType.startsWith('image/') || attachment.mimeType.startsWith('video/')) {
      userParts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.base64
        }
      });
    } else if (attachment.mimeType === 'text') {
      userParts[0].text = `[Attached Document: ${attachment.name}]\n${attachment.base64}\n\nUser Question: ${userText}`;
    }
  }
  contents.push({ role: 'user', parts: userParts });

  try {
    return await generateText({
      prompt: userText,
      systemInstruction,
      contents,
      temperature: 0.7
    });
  } catch (e) {
    console.error("[geminiService] getMentorChatReply failed:", e);
    return "I'm having trouble connecting right now. Please try again or switch to offline mode.";
  }
};
