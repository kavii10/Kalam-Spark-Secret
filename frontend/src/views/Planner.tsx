
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, CheckCircle2, Circle, Trash2, Target,
  RefreshCw, Zap, Calendar as CalendarIcon, Flame, Trophy,
  HelpCircle, CheckCircle, XCircle, Loader2, ListTodo, History, Newspaper
} from 'lucide-react';
import { DailyTask, QuizQuestion } from '../types';
import { dbService } from '../services/dbService';
import { fetchDirectResources, isUpscDream, fetchCurrentAffairs } from '../services/resourceApiService';
import { generateMicroQuiz, generatePlannerTasks } from '../services/geminiService';
import { taskRevisionService } from '../services/taskRevisionService';
import { grantReward, makeDailyTasksReward, makePerfectQuizReward } from '../services/rewardService';
import { networkService } from '../services/networkService';
import { llamaPlugin } from '../services/llamaPlugin';

// ─── Task Type Badge Colors ──────────────────────────────────────────────────
const TASK_BADGES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  'theory':          { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.35)',  text: '#60a5fa', label: 'Theory' },
  'hands-on':        { bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.35)',  text: '#fb923c', label: 'Hands-on' },
  'review':          { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.35)',   text: '#4ade80', label: 'Review' },
  'current-affairs': { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.35)',   text: '#f87171', label: 'Current Affairs' },
};

// ─── Task Variety Counter (localStorage) ─────────────────────────────────────
const VARIETY_KEY = 'ks_task_variety';
const TARGET_KEY = 'ks_task_target';

function getTaskTarget(): number {
  return parseInt(localStorage.getItem(TARGET_KEY) || '5');
}
function setTaskTarget(count: number) {
  localStorage.setItem(TARGET_KEY, Math.max(5, Math.min(10, count)).toString());
}

function getVarietyMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(VARIETY_KEY) || '{}');
  } catch { return {}; }
}

function markTaskUsed(title: string) {
  const map = getVarietyMap();
  map[title.trim().toLowerCase()] = Date.now();
  // Purge entries older than 7 days
  const week = 7 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(map)) {
    if (Date.now() - map[k] > week) delete map[k];
  }
  localStorage.setItem(VARIETY_KEY, JSON.stringify(map));
}

function wasUsedRecently(title: string): boolean {
  const map = getVarietyMap();
  const ts = map[title.trim().toLowerCase()];
  if (!ts) return false;
  return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
}

// ─── Shared Styles ───────────────────────────────────────────────────────────
const GS = {
  card: { background: 'rgba(6,3,18,0.45)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,140,66,0.22)', borderRadius: 16 } as React.CSSProperties,
  cardHover: 'hover:border-orange-400/50 transition-all duration-300',
  input: { background: 'rgba(6,3,18,0.50)', border: '1px solid rgba(255,140,66,0.22)', color: '#ffb380', borderRadius: 12 } as React.CSSProperties,
};

// ─── Daily Reset Key ─────────────────────────────────────────────────────────
const RESET_KEY = 'ks_last_task_reset';

function normalizeTaskType(raw: string | undefined): string {
  if (!raw) return 'theory';
  const t = raw.toLowerCase().trim();
  if (t === 'theory' || t === 'reading' || t === 'study' || t === 'watch') return 'theory';
  if (t === 'hands-on' || t === 'hands_on' || t === 'practical' || t === 'practice' || t === 'project' || t === 'build' || t === 'coding' || t === 'exercise') return 'hands-on';
  if (t === 'review' || t === 'revision' || t === 'revise' || t === 'quiz' || t === 'test' || t === 'assessment') return 'review';
  if (t === 'current-affairs' || t === 'current_affairs' || t === 'news' || t === 'current affairs') return 'current-affairs';
  if (t.includes('hands') || t.includes('practic') || t.includes('build') || t.includes('code') || t.includes('implement')) return 'hands-on';
  if (t.includes('review') || t.includes('revis') || t.includes('quiz') || t.includes('test')) return 'review';
  if (t.includes('current') || t.includes('news') || t.includes('affair')) return 'current-affairs';
  return 'theory';
}

function getLastResetDate(): string {
  return localStorage.getItem(RESET_KEY) || '';
}
function setLastResetDate(dateStr: string) {
  localStorage.setItem(RESET_KEY, dateStr);
}

export default function Planner({ user, setUser, onXpGain }: { user: any; setUser?: React.Dispatch<React.SetStateAction<any>>; onXpGain?: (amount: number) => void }) {

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [newTask, setNewTask] = useState('');

  // Quiz State
  const isLight = user?.settings?.theme === 'light';
  const [activeTab, setActiveTab] = useState<'tasks' | 'quiz'>('tasks');
  const [quizLoading, setQuizLoading] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizNumber, setQuizNumber] = useState(1);

  // Ref for the midnight interval
  const midnightRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Unified Study Center Resource Helper ───────────────────────────────────
  const getUnifiedResources = useCallback(async (rm: any, stageIdx: number, stage: any) => {
    let cached = rm.cachedResources;
    // Use concepts (specific learnable items) first, then subjects as fallback
    // This ensures resources are loaded for specific items like "Linear Algebra", "Calculus", "Python"
    // instead of generic stage titles like "Foundations of Math"
    const stageSubjects: string[] = (stage?.concepts && stage.concepts.length > 0)
      ? stage.concepts
      : (stage?.subjects || []);
    const dreamMismatch = cached?.cachedForDream && cached.cachedForDream !== user.dream;
    const stageMismatch = cached?.cachedForStage !== undefined && cached.cachedForStage !== stageIdx;
    // Concepts/Subjects mismatch: old cache was built from generic stage title instead of specific concepts
    const cachedSubs: string[] = (cached as any)?.cachedSubjects || [];
    const subjectsMismatch = stageSubjects.length > 0 && (
      cachedSubs.length === 0 ||
      !stageSubjects.every((s: string, i: number) => s === cachedSubs[i])
    );

    const sparseCache = cached && (
      (!Array.isArray(cached.books) || cached.books.length === 0) &&
      (!Array.isArray(cached.videos) || cached.videos.length === 0)
    );

    if (!cached || dreamMismatch || stageMismatch || sparseCache || subjectsMismatch) {
      try {
        console.log('[Planner] Fetching fresh resources for task allocation (subjects:', stageSubjects, ')');
        // Pass '' as stageTopic so fetchDirectResources uses subjects only, not stage title
        const fetched = await fetchDirectResources(
          user.dream,
          '',
          stageSubjects,
          user.year
        );

        const stageSubjectsLower = stageSubjects.map((s: string) => s.toLowerCase());
        const scoreItem = (title: string) => {
          const t = title.toLowerCase();
          return stageSubjectsLower.some(s => t.includes(s)) ? 0 : 1;
        };

        cached = {
          books:  (Array.isArray(fetched.books)  ? fetched.books  : []).filter((b: any) => b?.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
          videos: (Array.isArray(fetched.videos) ? fetched.videos : []).filter((v: any) => v?.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
          papers: (Array.isArray(fetched.papers) ? fetched.papers : []).filter((p: any) => p?.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
          news:   (Array.isArray(fetched.news)   ? fetched.news   : []).filter((n: any) => n?.link?.startsWith('http')).slice(0, 10),
          cachedForDream: user.dream,
          cachedForStage: stageIdx,
          cachedSubjects: stageSubjects,
          resourceOffset: 0
        };
        rm.cachedResources = cached;
        await dbService.saveRoadmap(user, rm);
      } catch (err) {
        console.warn('[Planner] Failed to fetch resources online, returning empty cache placeholder:', err);
        cached = { books: [], videos: [], papers: [], news: [], cachedForDream: user.dream, cachedForStage: stageIdx, cachedSubjects: stageSubjects, resourceOffset: 0 };
      }
    }
    return cached;
  }, [user.id, user.dream, user.year]);

  // ── Daily Reset Logic ───────────────────────────────────────────────────
  const performDailyReset = useCallback(async () => {
    const todayStr = new Date().toDateString();
    if (getLastResetDate() === todayStr) return; // Already reset today

    console.log('[Planner] Performing daily task reset');
    const allTasks = await dbService.getTasks(user.id);

    // Archive (delete) completed tasks from prior days
    let completedCount = 0;
    for (const t of allTasks) {
      if (t.completed) {
        completedCount++;
        markTaskUsed(t.title); // record in variety tracker
        await dbService.deleteTask(t.id);
      }
    }

    // Decrease target if completion was poor (less than 50% done)
    if (allTasks.length > 5 && completedCount < allTasks.length / 2) {
      const current = getTaskTarget();
      setTaskTarget(current - 1);
    }

    // Keep uncompleted tasks, reschedule to today
    const remaining: DailyTask[] = [];
    for (const t of allTasks) {
      if (!t.completed) {
        const updated = { ...t, date: new Date().toISOString() };
        await dbService.saveTask(user.id, updated);
        remaining.push(updated);
      }
    }

    setTasks(remaining);
    setLastResetDate(todayStr);

    // Auto-generate fresh tasks to fill to target
    const target = getTaskTarget();
    if (remaining.length < target) {
      await syncFromRoadmap(remaining);
    }
  }, [user.id]);

  // ── Initial Load + Midnight Timer ─────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const todayStr = new Date().toDateString();

        // Check if we need to do a daily reset first
        if (getLastResetDate() !== todayStr) {
          await performDailyReset();
          return; // performDailyReset calls setTasks and syncFromRoadmap
        }

        // Normal load for same-day
        const allTasks = await dbService.getTasks(user.id).catch(() => []);
        if (!Array.isArray(allTasks)) {
          setTasks([]);
          return;
        }
        const seen = new Set<string>();
        const unique: DailyTask[] = [];
        const dupeIds: string[] = [];

        for (const t of allTasks) {
          const key = t.title.trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            if (!t.completed && new Date(t.date).toDateString() !== todayStr) {
              const updated = { ...t, date: new Date().toISOString() };
              unique.push(updated);
              dbService.saveTask(user.id, updated).catch(e => console.error('Failed to save task:', e));
            } else {
              unique.push(t);
            }
          } else {
            dupeIds.push(t.id);
          }
        }
        for (const id of dupeIds) dbService.deleteTask(id).catch(e => console.error('Failed to delete duplicate task:', e));

        const uiTasks = unique.filter(t => !t.completed || new Date(t.date).toDateString() === todayStr);
        setTasks(uiTasks);

        // Helper to check if resources changed
        const resourcesChanged = (currentTasks: DailyTask[], cache: any) => {
          if (!cache) return false;
          const cacheTitles = new Set([
            ...(cache.books || []).map((b: any) => b.title.trim().toLowerCase()),
            ...(cache.videos || []).map((v: any) => v.title.trim().toLowerCase()),
            ...(cache.papers || []).map((p: any) => p.title.trim().toLowerCase()),
            ...(cache.news || []).map((n: any) => n.title.trim().toLowerCase()),
          ]);
          if (cacheTitles.size === 0) return false;

          const taskHasCacheResource = currentTasks.some(t => {
            const tTitle = t.title.toLowerCase();
            return [...cacheTitles].some(cTitle => tTitle.includes(cTitle));
          });
          return !taskHasCacheResource;
        };

        const rm = await dbService.getRoadmap(user.id) || {};
        const cached = rm.cachedResources || {};
        const activeTasks = uiTasks.filter(x => !x.completed);
        const allDone = uiTasks.length > 0 && activeTasks.length === 0;
        const changed = resourcesChanged(uiTasks, cached);

        if (uiTasks.length === 0 || allDone || (changed && uiTasks.length > 0)) {
          syncFromRoadmap(uiTasks, allDone || changed);
        }
      } catch (e) {
        console.error('Failed to initialize tasks:', e);
        setTasks([]);
      }
    };

    init();
    
    // Set up a midnight check interval (every 60 seconds)
    midnightRef.current = setInterval(() => {
      const todayStr = new Date().toDateString();
      if (getLastResetDate() !== todayStr) {
        performDailyReset().catch(e => console.error('Midnight reset failed:', e));
      }
    }, 60_000);

    return () => {
      if (midnightRef.current) clearInterval(midnightRef.current);
    };
  }, [user.id, user.dream, performDailyReset]); // Added user.dream to ensure tasks load once dream is set

  const addTask = (title: string, type: any = 'theory') => {
    if (!title.trim()) return;
    const task: DailyTask = { id: Math.random().toString(36).substr(2, 9), title: title.trim(), type, completed: false, date: new Date().toISOString() };
    setTasks(prev => [...prev, task]);
    dbService.saveTask(user.id, task);
    setNewTask('');
  };

  const syncFromRoadmap = async (currentTasksOverride?: DailyTask[], forceRegenerate = false) => {
    setSyncing(true);
    try {
      let rm = await dbService.getRoadmap(user.id) || {};
      const baseTasks = currentTasksOverride || tasks;
      
      let activeTasks = forceRegenerate ? [] : baseTasks.filter(t => !t.completed);
      
      if (forceRegenerate) {
        const uncompleted = baseTasks.filter(t => !t.completed);
        for (const t of uncompleted) {
          await dbService.deleteTask(t.id).catch(() => {});
        }
        setTasks(prev => prev.filter(p => p.completed));
      }
      
      const existingTitles = new Set((forceRegenerate ? [] : baseTasks).map(t => t.title.trim().toLowerCase()));
      const target = getTaskTarget();
      const neededTasks = target - activeTasks.length;

      if (neededTasks > 0) {
        if (neededTasks === target && baseTasks.filter(t => t.completed).length > 0 && !forceRegenerate) {
          for (const t of baseTasks.filter(t => t.completed)) {
            markTaskUsed(t.title);
            dbService.deleteTask(t.id).catch(() => {});
          }
          setTasks(prev => prev.filter(p => !p.completed));
          existingTitles.clear();
        }

        const stageIdx = user.currentStageIndex || 0;
        const stage = rm.stages ? (rm.stages[stageIdx] || rm.stages[0]) : null;
        // Use concepts (specific learnable items) first, then subjects as fallback
        // This ensures resources are loaded for specific items like "Linear Algebra", "Calculus", "Python"
        // instead of generic stage titles like "Foundations of Math"
        const stageSubjects: string[] = (stage?.concepts && stage.concepts.length > 0)
          ? stage.concepts
          : (stage?.subjects?.length ? stage.subjects : [user.dream]);
        // Use first subject/concept as topic for task generation (not the generic stage title)
        const topic = stageSubjects[0] || (stage ? stage.title : user.dream);

        const cached = await getUnifiedResources(rm, stageIdx, stage);

        let pool: { title: string; type: string }[] = [];
        
        const booksList = cached.books || [];
        const videosList = cached.videos || [];
        const papersList = cached.papers || [];
        const newsList = cached.news || [];
        
        const offset = cached.resourceOffset || 0;
        const maxLen = Math.max(booksList.length, videosList.length, papersList.length, newsList.length);
        let currentOffset = offset;
        if (maxLen > 0 && currentOffset >= maxLen) {
          currentOffset = 0;
        }
        
        const slicedBooks = booksList.slice(currentOffset, currentOffset + 5);
        const slicedVideos = videosList.slice(currentOffset, currentOffset + 5);
        const slicedPapers = papersList.slice(currentOffset, currentOffset + 2);
        const slicedNews = newsList.slice(currentOffset, currentOffset + 2);

        for (const b of slicedBooks) {
          pool.push({ title: `Read Book: ${b.title}`, type: 'theory' });
        }
        for (const v of slicedVideos) {
          pool.push({ title: `Watch Lecture: ${v.title}`, type: 'hands-on' });
        }
        for (const p of slicedPapers) {
          pool.push({ title: `Study Research Paper: ${p.title}`, type: 'theory' });
        }
        for (const n of slicedNews) {
          pool.push({ title: `Review News: ${n.title}`, type: 'review' });
        }

        if (pool.length > 0) {
          cached.resourceOffset = currentOffset + 5;
          rm.cachedResources = cached;
          await dbService.saveRoadmap(user, rm);
        }

        if (pool.length === 0) {
          const getBackendUrl = () => {
            const envUrl = import.meta.env.VITE_BACKEND_URL;
            if (envUrl) return envUrl.replace(/\/$/, '');
            if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
              return window.location.origin;
            }
            return "http://localhost:8000";
          };
          const backendUrl = getBackendUrl();
          const isOnline = networkService.isOnline();

          if (isOnline) {
            try {
              const res = await fetch(`${backendUrl}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dream: user.dream, current_stage: topic, subjects: stageSubjects, count: target })
              });
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                  pool = data.map((t: any) => ({
                    title: (t.title || '').trim(),
                    type: normalizeTaskType(t.type)
                  })).filter((t: any) => t.title && t.title.length > 5);
                }
              }
            } catch (e) {
              console.warn('Backend tasks failed, trying direct Gemini API...', e);
            }

            if (pool.length === 0) {
              try {
                const data = await generatePlannerTasks(user.dream, topic, stageSubjects, neededTasks);
                if (Array.isArray(data)) {
                  pool = data.map((t: any) => ({
                    title: (t.title || '').trim(),
                    type: normalizeTaskType(t.type)
                  })).filter((t: any) => t.title && t.title.length > 5);
                }
              } catch (err) {
                console.error("Task generation service call failed:", err);
              }
            }
          } else {
            if (llamaPlugin.isSupported()) {
              console.log('[Planner] Running offline, generating tasks using local model...');
              try {
                const subjectsStr = stageSubjects.join(', ');
                const prompt = `Create exactly ${neededTasks} diverse, actionable daily tasks for a student studying to become a ${user.dream}, focusing on these specific subjects: ${subjectsStr}.
Rules:
- Each task "type" MUST be one of: "theory", "hands-on", "review" (NO other values)
- "theory" = reading/studying a specific concept or chapter in one of the listed subjects
- "hands-on" = building, practicing, coding, or implementing something from one of the listed subjects
- "review" = revising, summarizing, or quizzing yourself on one of the listed subjects
- Mix types: include at least 2 hands-on and 1 review task
- Titles MUST be subject-specific — use the actual subject name in the task title
- Bad example: {"title": "Read about something", "type": "theory"}
- Good example: {"title": "Study linear transformations in Linear Algebra", "type": "theory"}
- Another good example: {"title": "Implement gradient descent in Python", "type": "hands-on"}

Return a JSON array of exactly ${neededTasks} tasks.`;
                const resText = await llamaPlugin.getCompletion(prompt, "You are an expert educator. Return ONLY raw JSON array. No markdown.");
                let clean = resText.trim();
                const startIdx = clean.indexOf('[');
                const endIdx = clean.lastIndexOf(']');
                if (startIdx !== -1 && endIdx !== -1) {
                  clean = clean.substring(startIdx, endIdx + 1);
                }
                const data = JSON.parse(clean);
                if (Array.isArray(data)) {
                  pool = data.map((t: any) => ({
                    title: (t.title || '').trim(),
                    type: normalizeTaskType(t.type)
                  })).filter((t: any) => t.title && t.title.length > 5);
                }
              } catch (err) {
                console.error("Local model task generation failed:", err);
              }
            }
          }
        }

        if (isUpscDream(user.dream)) {
          try {
            const caItems = await fetchCurrentAffairs(2);
            for (const ca of caItems) {
              pool.push({ title: `📰 Current Affairs: ${ca.title}`, type: 'current-affairs' });
            }
          } catch { /* silent */ }
        }

        const addedTasks: DailyTask[] = [];
        const dreamWords = user.dream.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const subjectWords = stageSubjects.join(' ').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const requiredKeywords = [...dreamWords, ...subjectWords];

        for (const candidate of pool) {
          if (addedTasks.length >= neededTasks) break;
          const key = candidate.title.trim().toLowerCase();

          const isDirectResource = candidate.title.startsWith('Read Book:') || 
                                   candidate.title.startsWith('Watch Lecture:') || 
                                   candidate.title.startsWith('Study Research Paper:') || 
                                   candidate.title.startsWith('Review News:');

          if (!isDirectResource && wasUsedRecently(candidate.title)) continue;

          const isRelevant = isDirectResource || 
                             requiredKeywords.some(kw => key.includes(kw)) || 
                             key.split(/\s+/).some(w => requiredKeywords.includes(w));
          if (!isRelevant && pool.length > neededTasks && candidate.type !== 'current-affairs') continue;

          if (existingTitles.has(key)) continue;
          existingTitles.add(key);
          const task: DailyTask = {
            id: Math.random().toString(36).substr(2, 9),
            title: candidate.title,
            type: (normalizeTaskType(candidate.type) as any),
            completed: false,
            date: new Date().toISOString()
          };
          dbService.saveTask(user.id, task);
          if (!isDirectResource) {
            markTaskUsed(candidate.title);
          }
          addedTasks.push(task);
        }
        if (addedTasks.length > 0) {
          setTasks(prev => { 
            const prevIds = new Set(prev.map(t => t.id)); 
            return [...prev.filter(t => !forceRegenerate || t.completed), ...addedTasks.filter(t => !prevIds.has(t.id))]; 
          });
        }
      }
    } catch (e) { 
      console.error('syncFromRoadmap error:', e); 
    } finally { 
      setSyncing(false); 
    }
  };

  const toggleTask = (id: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, completed: !t.completed };
        dbService.saveTask(user.id, updated);
        if (!t.completed) {
          if (onXpGain) onXpGain(25);
          taskRevisionService.enqueueTask(user.id, t.id, t.title, t.type);
        }
        return updated;
      }
      return t;
    });
    setTasks(updatedTasks);

    // Check if ALL tasks are now complete → Day Champion reward
    const allDone = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);
    if (allDone) {
      // Increase target for next time if we're consistently doing well
      const current = getTaskTarget();
      setTaskTarget(current + 1);

      const today = new Date().toISOString().split('T')[0];
      const reward = makeDailyTasksReward(today);
      // Pass real setUser callback so the reward appears on Dashboard immediately
      grantReward(user, reward, (updatedUser) => {
        if (setUser) setUser(updatedUser);
      });

      // Automatically generate new tasks when all are completed
      setTimeout(() => {
        syncFromRoadmap(updatedTasks, true);
      }, 1500);
    }
  };



  const deleteTask = (id: string) => { setTasks(tasks.filter(t => t.id !== id)); dbService.deleteTask(id); };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const efficiency = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStartQuiz = async () => {
    const completedTaskTitles = tasks.filter(t => t.completed).map(t => t.title);
    if (completedTaskTitles.length === 0) {
      alert("Please complete at least one task today before generating a quiz.");
      return;
    }
    setQuizLoading(true); setShowResults(false); setAnswers({});
    try {
      const rm = await dbService.getRoadmap(user.id).catch(() => null);
      if (!rm?.stages || !Array.isArray(rm.stages) || rm.stages.length === 0) {
        throw new Error('Could not load roadmap data');
      }
      const stageIndex = Math.min(user.currentStageIndex, rm.stages.length - 1);
      const currentStage = rm.stages[stageIndex];
      const allTaskTitles = tasks.map(t => t.title);
      const quiz = await generateMicroQuiz(
        currentStage?.title || currentStage?.subjects?.[0] || user.dream, 
        allTaskTitles,
        { description: currentStage?.description, concepts: currentStage?.subjects },
        completedTaskTitles,
        quizNumber
      );
      if (quiz && Array.isArray(quiz) && quiz.length > 0) {
        setCurrentQuiz(quiz);
        setQuizNumber(prev => prev + 1);
      } else {
        throw new Error('Invalid quiz data received');
      }
    } catch (e: any) { 
      console.error('Quiz generation failed:', e);
      alert(e.message || 'Quiz generation failed.');
    } finally { 
      setQuizLoading(false); 
    }
  };

  const calculateScore = () => !currentQuiz ? 0 : currentQuiz.filter((q, idx) => answers[idx] === q.correctAnswer).length;

  // Render tasks with completed ones at the bottom
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  const getBadge = (type: string) => {
    if (!type) return TASK_BADGES['theory'];
    const t = type.toLowerCase().trim();
    // Exact match first
    if (TASK_BADGES[t]) return TASK_BADGES[t];
    // Fuzzy match common variants
    if (t.includes('hands') || t.includes('practice') || t.includes('project') || t.includes('build') || t.includes('code') || t.includes('implement') || t.includes('exercise')) return TASK_BADGES['hands-on'];
    if (t.includes('review') || t.includes('revise') || t.includes('summary') || t.includes('quiz') || t.includes('test') || t.includes('assess')) return TASK_BADGES['review'];
    if (t.includes('current') || t.includes('affair') || t.includes('news') || t.includes('trend')) return TASK_BADGES['current-affairs'];
    return TASK_BADGES['theory'];
  };


  return (
    <div className="space-y-7 fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <h2 className="heading-gold font-cinzel text-2xl font-bold">Task Planner</h2>
          <p className="text-xs text-gold-500/50 mt-1">Daily tasks for your <span className="text-gold-400">{user.dream}</span> journey</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,140,66,0.06)', border: '1px solid rgba(255,140,66,0.20)' }}>
            {(['tasks', 'quiz'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize"
                style={activeTab === tab
                  ? { background: 'linear-gradient(135deg,#ea580c,#ff8c42)', color: 'white' }
                  : { color: isLight ? '#ea580c' : 'rgba(255,140,66,0.50)' }}>
                {tab === 'tasks' ? <ListTodo size={13} /> : <HelpCircle size={13} />} {tab}
              </button>
            ))}
          </div>

          {activeTab === 'tasks' && (
            <button
              onClick={() => syncFromRoadmap(undefined, true)}
              disabled={syncing}
              className="planner-sync-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all text-gold-400/80 disabled:opacity-40"
              style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.25)' }}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> Sync Roadmap
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {totalCount > 0 && activeTab === 'tasks' && (
        <div className="glass-card p-4 flex items-center gap-4" style={{ borderColor: 'rgba(255,140,66,0.20)' }}>
          <div className="flex-1 progress-track h-2">
            <div className="progress-bar-gold h-full" style={{ width: `${efficiency}%` }} />
          </div>
          <span className="text-xs text-gold-500/50 shrink-0 font-medium">{completedCount} of {totalCount} tasks</span>
        </div>
      )}

      {activeTab === 'tasks' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <input
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask(newTask)}
              placeholder="Add a new task..."
              className="planner-input w-full px-5 py-4 text-sm rounded-xl outline-none pr-14"
              style={GS.input}
            />
            <button
              onClick={() => addTask(newTask)}
              disabled={!newTask.trim()}
              className="absolute right-2.5 top-2.5 w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #ea580c, #ff8c42)' }}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Tasks */}
          <div className="space-y-2.5">
            {sortedTasks.length > 0 ? sortedTasks.map(task => {
              const badge = getBadge(task.type);
              return (
              <div
                key={task.id}
                className={`glass-card flex items-center gap-4 p-4 group transition-all duration-300 ${task.completed ? 'opacity-50' : 'hover:border-orange-400/40'}`}
                style={{ borderColor: task.completed ? 'rgba(255,140,66,0.10)' : 'rgba(255,140,66,0.22)' }}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="shrink-0 transition-colors"
                  style={{ color: task.completed ? '#ff8c42' : 'rgba(255,140,66,0.30)' }}
                >
                  {task.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium transition-all ${task.completed ? 'planner-task-text-completed' : 'planner-task-text'}`} style={{ color: task.completed ? 'rgba(255,140,66,0.40)' : '#ffb380', textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {/* Category Badge */}
                    <span
                      className="task-category-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text }}
                    >
                      {task.type === 'current-affairs' && <Newspaper size={9} />}
                      {badge.label}
                    </span>
                    {task.completed && <span className="text-[10px] font-semibold text-gold-400">+25 XP</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-red-400/50 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              );
            }) : (
              <div className="py-16 text-center rounded-xl flex flex-col items-center gap-3"
                style={{ border: '1px dashed rgba(255,140,66,0.18)' }}>
                <CalendarIcon size={30} style={{ color: 'rgba(255,140,66,0.25)' }} />
                <p className="text-sm text-gold-500/40">No tasks yet</p>
                <p className="text-xs text-gold-500/25">Add a task above or sync from your roadmap</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-6" style={{ borderColor: 'rgba(255,140,66,0.22)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-gold-400" />
              <p className="text-sm font-semibold text-gold-300">How it works</p>
            </div>
            <ul className="space-y-3">
              {[
                'Tasks auto-refresh every morning at midnight',
                'Unfinished tasks carry over to the next day',
                'Each completed task earns you +25 XP',
                'Tasks won\'t repeat within 7 days',
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed planner-how-it-works-text" style={{ color: 'rgba(255,160,100,0.55)' }}>
                  <span className="text-gold-500 shrink-0 mt-0.5">›</span> {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Legend */}
          <div className="glass-card p-5" style={{ borderColor: 'rgba(255,140,66,0.22)' }}>
            <p className="text-xs font-semibold text-gold-300 mb-3">Task Types</p>
            <div className="space-y-2">
              {Object.entries(TASK_BADGES).map(([key, b]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: b.text }} />
                  <span className="text-[11px] font-medium" style={{ color: b.text }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {totalCount > 0 && (
          <div className="glass-card planner-stats-box p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gold-500/10 rounded-full mix-blend-screen filter blur-xl group-hover:bg-orange-500/20 transition-all duration-500" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gold-500/10 text-gold-400"><History size={18} /></div>
              <h3 className="text-sm font-semibold text-gold-200">Today's Stats</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-gold-500/10">
                <span className="text-xs text-gold-500/50 font-medium">Completed</span>
                <span className="text-sm font-bold text-emerald-400">{completedCount}</span>
              </div>
              <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-orange-500/10">
                <span className="text-xs text-gold-500/50 font-medium">Remaining</span>
                <span className="text-sm font-bold text-orange-400">{totalCount - completedCount}</span>
              </div>
              <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-purple-500/10">
                <span className="text-xs text-gold-500/50 font-medium">XP Earned</span>
                <span className="text-sm font-bold text-purple-400">+{completedCount * 25}</span>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
      ) : (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {!currentQuiz ? (
            <div className={`glass-card p-10 text-center space-y-6 ${isLight ? 'bg-white border-orange-200 shadow-sm' : ''}`} style={{ borderColor: isLight ? undefined : 'rgba(255,140,66,0.22)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: isLight ? 'rgba(255,140,66,0.15)' : 'rgba(255,140,66,0.10)', border: isLight ? '1px solid rgba(255,140,66,0.3)' : '1px solid rgba(255,140,66,0.28)' }}>
                {quizLoading ? <Loader2 size={28} className="animate-spin text-orange-500" /> : <HelpCircle size={28} className="text-orange-500" />}
              </div>
              <div>
                <h3 className={`text-xl font-bold mb-2 font-cinzel ${isLight ? 'text-zinc-800' : 'text-gold-200'}`}>Quiz Time</h3>
                {completedCount === 0 ? (
                  <p className="text-red-400 font-semibold text-sm">
                    Complete at least one task today to unlock today's quiz!
                  </p>
                ) : (
                  <p className={`${isLight ? 'text-orange-600' : 'text-gold-400'} font-semibold text-sm`}>
                    Test your knowledge on {user.dream}
                  </p>
                )}
              </div>
              <button 
                onClick={handleStartQuiz} 
                disabled={quizLoading || completedCount === 0} 
                className="btn-primary px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {quizLoading ? 'Generating...' : 'Start Quiz'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {currentQuiz.map((q, qIdx) => (
                <div key={qIdx} className={`glass-card p-6 ${isLight ? 'bg-white border-zinc-200 shadow-sm' : ''}`} style={{ borderColor: isLight ? undefined : 'rgba(255,140,66,0.22)' }}>
                  <p className={`text-xs mb-2 ${isLight ? 'text-zinc-500' : 'text-gold-500/35'}`}>Question {qIdx + 1}</p>
                  <h4 className={`text-base font-semibold mb-5 ${isLight ? 'text-zinc-800' : 'text-gold-200'}`}>{q.question}</h4>
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = answers[qIdx] === oIdx;
                      const isCorrect = oIdx === q.correctAnswer;
                      let style: React.CSSProperties = isLight
                        ? { background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.1)', color: '#4b5563', borderRadius: 12 }
                        : { background: 'rgba(255,140,66,0.05)', border: '1px solid rgba(255,140,66,0.18)', color: 'rgba(255,179,128,0.80)', borderRadius: 12 };
                      if (showResults) {
                        if (isCorrect) style = isLight
                          ? { background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.5)', color: '#059669', borderRadius: 12, fontWeight: 600 }
                          : { background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.40)', color: '#6ee7b7', borderRadius: 12 };
                        else if (isSelected) style = isLight
                          ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', color: '#dc2626', borderRadius: 12 }
                          : { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.40)', color: '#fca5a5', borderRadius: 12 };
                      } else if (isSelected) {
                        style = isLight
                          ? { background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.5)', color: '#ea580c', borderRadius: 12, fontWeight: 600 }
                          : { background: 'rgba(255,140,66,0.18)', border: '1px solid rgba(255,140,66,0.55)', color: '#ff8c42', borderRadius: 12 };
                      }
                      return (
                        <button key={oIdx} onClick={() => !showResults && setAnswers({ ...answers, [qIdx]: oIdx })}
                          className="w-full text-left p-4 flex items-center gap-3 text-sm transition-all"
                          style={style}>
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isSelected ? (isLight ? '#ea580c' : '#ff8c42') : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,140,66,0.25)') }} />
                          {opt}
                          {showResults && isCorrect && <CheckCircle size={14} className="ml-auto text-emerald-400 shrink-0" />}
                          {showResults && isSelected && !isCorrect && <XCircle size={14} className="ml-auto text-red-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {showResults && q.explanation && (
                    <div className="mt-4 p-4 rounded-xl" style={isLight ? { background: 'rgba(249,115,22,0.1)', borderLeft: '3px solid #ea580c' } : { background: 'rgba(255,140,66,0.06)', borderLeft: '3px solid #ff8c42' }}>
                      <p className="text-xs leading-relaxed" style={{ color: isLight ? '#4b5563' : 'rgba(255,179,128,0.70)' }}>{q.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
              {!showResults ? (
                <button onClick={() => {
                  setShowResults(true);
                  if (!currentQuiz) return;
                  // Check for perfect score → Quiz Master reward
                  const score = currentQuiz.filter((q, i) => answers[i] === q.correctAnswer).length;
                  if (score === currentQuiz.length && currentQuiz.length > 0) {
                    const today = new Date().toISOString().split('T')[0];
                    const topic = currentQuiz[0]?.question?.split(' ').slice(0, 4).join(' ') || user.dream;
                    grantReward(user, makePerfectQuizReward(topic, today), (u) => { if (setUser) setUser(u); });
                  }
                }} disabled={!currentQuiz || Object.keys(answers).length < currentQuiz.length}
                  className="btn-primary w-full py-4 rounded-xl font-semibold text-sm disabled:opacity-30">
                  Check Answers
                </button>
              ) : (
                <div className={`glass-card p-8 text-center space-y-4 ${isLight ? 'bg-white border-orange-200 shadow-sm' : ''}`} style={{ borderColor: isLight ? undefined : 'rgba(255,140,66,0.22)' }}>
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold" style={{ background: 'rgba(255,140,66,0.12)', border: '1px solid rgba(255,140,66,0.35)', color: isLight ? '#ea580c' : '#ff8c42' }}>
                    <Trophy size={16} /> Score: {calculateScore()}/{currentQuiz.length}
                  </div>
                  <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-gold-500/50'}`}>{calculateScore() === currentQuiz.length ? '🎉 Perfect score!' : calculateScore() >= currentQuiz.length / 2 ? '👍 Good job! Keep practicing.' : '📚 Keep studying and try again!'}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setCurrentQuiz(null); setAnswers({}); setShowResults(false); setQuizNumber(1); }}
                      className="btn-secondary flex-1 py-3 rounded-xl font-medium text-sm">
                      Try Again
                    </button>
                    <button onClick={handleStartQuiz} disabled={quizLoading}
                      className="btn-primary flex-1 py-3 rounded-xl font-medium text-sm disabled:opacity-30">
                      {quizLoading ? 'Loading...' : 'Next Quiz'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
