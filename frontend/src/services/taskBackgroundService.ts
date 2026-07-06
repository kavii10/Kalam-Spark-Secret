import { dbService } from './dbService';
import { generatePlannerTasks } from './geminiService';
import { fetchDirectResources, isUpscDream, fetchCurrentAffairs } from './resourceApiService';
import { networkService } from './networkService';
import { llamaPlugin } from './llamaPlugin';
import { DailyTask, UserProfile } from '../types';

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
  const week = 7 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(map)) {
    if (Date.now() - map[k] > week) delete map[k];
  }
  localStorage.setItem(VARIETY_KEY, JSON.stringify(map));
}

function wasUsedRecently(title: string, windowMs?: number): boolean {
  const map = getVarietyMap();
  const ts = map[title.trim().toLowerCase()];
  if (!ts) return false;
  return Date.now() - ts < (windowMs ?? 24 * 60 * 60 * 1000);
}

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

// Unified Study Center Resource Helper
async function getUnifiedResources(user: UserProfile, rm: any, stageIdx: number, stage: any) {
  let cached = rm.cachedResources;
  const stageSubjects: string[] = getStageSubjects(stage);
  const dreamMismatch = cached?.cachedForDream && cached.cachedForDream !== user.dream;
  const stageMismatch = cached?.cachedForStage !== undefined && cached.cachedForStage !== stageIdx;
  const cachedSubs: string[] = cached?.cachedSubjects || [];
  const subjectsMismatch = stageSubjects.length > 0 && (
    cachedSubs.length === 0 ||
    cachedSubs.length !== stageSubjects.length ||
    stageSubjects.some((s: string) => !cachedSubs.includes(s))
  );

  const sparseCache = cached && (
    (!Array.isArray(cached.books) || cached.books.length === 0) &&
    (!Array.isArray(cached.videos) || cached.videos.length === 0)
  );

  if (!cached || dreamMismatch || stageMismatch || sparseCache || subjectsMismatch) {
    try {
      console.log('[taskBackgroundService] Fetching fresh resources for task allocation');
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
      console.warn('[taskBackgroundService] Failed to fetch resources online, returning empty cache placeholder:', err);
      cached = { books: [], videos: [], papers: [], news: [], cachedForDream: user.dream, cachedForStage: stageIdx, cachedSubjects: stageSubjects, resourceOffset: 0 };
    }
  }
  return cached;
}

// Background task generator logic
let isGenerating = false;

export async function checkAndGenerateDailyTasks(
  user: UserProfile,
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>,
  forceRegenerate = false
): Promise<void> {
  if (isGenerating) return;
  isGenerating = true;

  try {
    const todayStr = new Date().toDateString();
    
    // Check if roadmap exists, otherwise we cannot generate tasks
    const rm = await dbService.getRoadmap(user.id).catch(() => null);
    if (!rm || !rm.stages || rm.stages.length === 0) {
      isGenerating = false;
      return;
    }

    let allTasks = await dbService.getTasks(user.id).catch(() => []);
    if (!Array.isArray(allTasks)) allTasks = [];

    let performReset = false;
    // 1. Check if new day reset is needed
    if (user.lastTaskResetDate !== todayStr) {
      performReset = true;
    }

    if (performReset) {
      console.log('[taskBackgroundService] Performing background daily task reset');
      let completedCount = 0;
      for (const t of allTasks) {
        if (t.completed) {
          completedCount++;
          await dbService.deleteTask(t.id).catch(() => {});
        }
      }

      // Decrease target if completion was poor
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

      allTasks = remaining;
      const updatedUser = { ...user, lastTaskResetDate: todayStr };
      setUser(updatedUser);
      await dbService.saveUser(updatedUser);
    }

    // 2. Check if we need to sync from roadmap (either empty, all completed, resources changed, or forceRegenerate)
    const activeTasks = allTasks.filter(x => !x.completed);
    const allDone = allTasks.length > 0 && activeTasks.length === 0;

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

    const cached = rm.cachedResources || {};
    const changed = resourcesChanged(allTasks, cached);

    if (allTasks.length === 0 || allDone || (changed && allTasks.length > 0) || forceRegenerate) {
      console.log('[taskBackgroundService] Generating daily tasks in background...');
      let baseTasks = allTasks;
      let activeTasksForSync = forceRegenerate ? [] : baseTasks.filter(t => !t.completed);

      if (forceRegenerate) {
        const uncompleted = baseTasks.filter(t => !t.completed);
        for (const t of uncompleted) {
          await dbService.deleteTask(t.id).catch(() => {});
        }
        baseTasks = baseTasks.filter(p => p.completed);
      }

      const existingTitles = new Set(
        baseTasks
          .filter(t => t.completed || !forceRegenerate)
          .map(t => t.title.trim().toLowerCase())
      );
      const target = getTaskTarget();
      const neededTasks = target - activeTasksForSync.length;

      if (neededTasks > 0) {
        const stageIdx = user.currentStageIndex || 0;
        const stage = rm.stages ? (rm.stages[stageIdx] || rm.stages[0]) : null;
        const stageSubjects: string[] = getStageSubjects(stage);
        const topic = stageSubjects[0] || (stage ? stage.title : user.dream);

        const unifiedCached = await getUnifiedResources(user, rm, stageIdx, stage);
        let pool: { title: string; type: string }[] = [];

        const isOnline = networkService.isOnline();
        if (isOnline) {
          const booksList = unifiedCached.books || [];
          const videosList = unifiedCached.videos || [];
          const papersList = unifiedCached.papers || [];
          const newsList = unifiedCached.news || [];
          
          const offset = unifiedCached.resourceOffset || 0;
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
            unifiedCached.resourceOffset = currentOffset + 5;
            rm.cachedResources = unifiedCached;
            await dbService.saveRoadmap(user, rm);
          }
        }

        if (pool.length === 0) {
          if (isOnline) {
            try {
              const data = await generatePlannerTasks(user.dream, topic, stageSubjects, neededTasks);
              if (Array.isArray(data)) {
                pool = data.map((t: any) => ({
                  title: (t.title || '').trim(),
                  type: normalizeTaskType(t.type)
                })).filter((t: any) => t.title && t.title.length > 5);
              }
            } catch (err) {
              console.error("[taskBackgroundService] Task generation service failed:", err);
            }
          } else {
            if (llamaPlugin.isSupported()) {
              try {
                const subjectsStr = stageSubjects.join(', ');
                const prompt = `Create exactly ${neededTasks} daily tasks for ${user.dream} focusing on: ${subjectsStr}. Return JSON array.`;
                const resText = await llamaPlugin.getCompletion(prompt, "You are an educator. Return raw JSON array.");
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
                console.error("[taskBackgroundService] Local task generation failed:", err);
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

        let dbTaskTitles: Set<string> = new Set();
        try {
          const dbTasks = await dbService.getTasks(user.id);
          for (const t of dbTasks) dbTaskTitles.add(t.title.trim().toLowerCase());
        } catch { /* silent */ }

        const addedTasks: DailyTask[] = [];
        const dreamWords = user.dream.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const subjectWords = stageSubjects.join(' ').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const requiredKeywords = [...dreamWords, ...subjectWords];

        for (const candidate of pool) {
          if (addedTasks.length >= neededTasks) break;
          const key = candidate.title.trim().toLowerCase();

          if (existingTitles.has(key) || dbTaskTitles.has(key)) continue;
          if (wasUsedRecently(candidate.title)) continue;

          const isDirectResource = candidate.title.startsWith('Read Book:') ||
                                   candidate.title.startsWith('Watch Lecture:') ||
                                   candidate.title.startsWith('Study Research Paper:') ||
                                   candidate.title.startsWith('Review News:');

          const isRelevant = isDirectResource ||
                             requiredKeywords.some(kw => key.includes(kw)) ||
                             key.split(/\s+/).some(w => requiredKeywords.includes(w));
          if (!isRelevant && pool.length > neededTasks && candidate.type !== 'current-affairs') continue;

          existingTitles.add(key);
          dbTaskTitles.add(key);
          const task: DailyTask = {
            id: Math.random().toString(36).substr(2, 9),
            title: candidate.title,
            type: (normalizeTaskType(candidate.type) as any),
            completed: false,
            date: new Date().toISOString()
          };
          await dbService.saveTask(user.id, task);
          markTaskUsed(candidate.title);
          addedTasks.push(task);
        }
      }
    }
  } catch (e) {
    console.error('[taskBackgroundService] checkAndGenerateDailyTasks failed:', e);
  } finally {
    isGenerating = false;
  }
}
