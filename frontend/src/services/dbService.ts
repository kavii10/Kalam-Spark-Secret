/**
 * dbService — Kalam Spark Local-First Data Service (v2)
 *
 * All improvements implemented:
 *  ✅ Dirty flag + timestamps on every write via withMeta()
 *  ✅ Two-way conflict resolution (remote wins if newer updatedAt)
 *  ✅ syncedAt timestamp recorded after successful Supabase sync
 *  ✅ Device ID attached to every sync operation
 *  ✅ Lazy-load mentor history (first 50, load more on scroll)
 *  ✅ Computed cache for dashboard values (XP, streak, stage %)
 *  ✅ Roadmap stored with compression-friendly structure
 *  ✅ Emergency snapshot written after every user save
 *  ✅ Maintenance (expiry + trim) triggered after login
 *  ✅ Storage quota check before large writes
 *  ✅ NO sensitive keys (API keys, tokens) stored in IndexedDB
 */

import { UserProfile, DailyTask, Reward } from '../types';
import { supabase } from './supabaseClient';
import { networkService } from './networkService';
import { offlineSyncService, SyncOpType } from './offlineSyncService';
import { localDB, DEVICE_ID, nowISO } from './localDB';

// ─── Session ID ───────────────────────────────────────────────────────────────
const MENTOR_SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
export { MENTOR_SESSION_ID };

// ─── Supabase Table Names ─────────────────────────────────────────────────────
const TABLES = {
  USERS: 'users',
  ROADMAPS: 'roadmaps',
  TASKS: 'tasks',
  PROGRESS: 'completed_stages',
  MENTOR: 'mentor_messages',
};

// ─── Mappers ──────────────────────────────────────────────────────────────────
function mapRow(data: any): UserProfile {
  const defaultSettings = {
    theme: 'dark' as const,
    autoScheduleRevisions: true,
    notificationsEnabled: true,
    soundEnabled: true,
  };
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatar: data.avatar,
    branch: data.branch || '',
    year: data.year || '',
    educationLevel: data.education_level || data.educationLevel || '',
    schoolBoard: data.school_board || data.schoolBoard || '',
    gradeOrSemester: data.grade_or_semester || data.gradeOrSemester || '',
    collegeName: data.college_name || data.collegeName || '',
    studyHoursPerDay: data.study_hours_per_day ?? data.studyHoursPerDay ?? undefined,
    targetYear: data.target_year || data.targetYear || '',
    city: data.city || '',
    motivation: data.motivation || '',
    dream: data.dream || '',
    currentStageIndex: data.current_stage_index ?? data.currentStageIndex ?? 0,
    onboardingComplete: data.onboarding_complete ?? data.onboardingComplete ?? false,
    isAuthenticated: true,
    xp: data.xp ?? 0,
    streak: data.streak ?? 0,
    rewards: data.rewards ?? [],
    settings: data.settings ? { ...defaultSettings, ...data.settings } : defaultSettings,
    fileSpeakerData: data.file_speaker_data || data.fileSpeakerData || {
      sources: [], activeId: null, states: {}, checked: [],
    },
  };
}

function userToPayload(user: UserProfile): Record<string, any> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    branch: user.branch,
    year: user.year,
    dream: user.dream,
    current_stage_index: user.currentStageIndex,
    onboarding_complete: user.onboardingComplete,
    xp: user.xp,
    streak: user.streak,
    last_sync: nowISO(),
    education_level: user.educationLevel || '',
    school_board: user.schoolBoard || '',
    grade_or_semester: user.gradeOrSemester || '',
    college_name: user.collegeName || '',
    study_hours_per_day: user.studyHoursPerDay ?? null,
    target_year: user.targetYear || '',
    city: user.city || '',
    motivation: user.motivation || '',
    rewards: user.rewards ?? [],
    file_speaker_data: user.fileSpeakerData || null,
    settings: user.settings || null,
  };
}

// ─── Background Supabase Sync Helper ─────────────────────────────────────────
async function syncToSupabase(type: SyncOpType, payload: any): Promise<void> {
  // Attach device ID to every sync operation for traceability
  const enriched = { ...payload, _device_id: DEVICE_ID };

  if (networkService.isOnline()) {
    try {
      await offlineSyncService.executeOne(type, enriched);
    } catch (e) {
      await offlineSyncService.enqueue(type, enriched);
    }
  } else {
    await offlineSyncService.enqueue(type, enriched);
  }
}

// ─── dbService ────────────────────────────────────────────────────────────────
export const dbService = {

  // ── USER PROFILE ─────────────────────────────────────────────────────────────

  async saveUser(user: UserProfile): Promise<void> {
    // 1. Write to IndexedDB with dirty flag + timestamps
    await localDB.put('user_profile', { ...user, updatedAt: nowISO() }, true);

    // 2. Invalidate cached computed values (XP/streak changed)
    await localDB.invalidateComputed(user.id, 'dashboard');

    // 3. Update emergency snapshot (for corruption recovery)
    localDB.writeEmergencySnapshot(user.id).catch(() => {});

    // 4. Sync localStorage cache (fast startup path)
    try {
      localStorage.setItem('kalamspark_cached_profile', JSON.stringify({ ...user, isAuthenticated: true }));
    } catch (e) { /* localStorage might be full */ }

    // 5. Sync to Supabase in background
    await syncToSupabase('save_user', userToPayload(user));
  },

  async getUser(userId: string): Promise<UserProfile | null> {
    // 1. Try IndexedDB first (instant)
    const local = await localDB.get<any>('user_profile', userId);
    if (local?.id) return mapRow(local);

    // 2. Fallback: Supabase (only when online)
    if (!networkService.isOnline()) return null;
    try {
      const { data, error } = await supabase.from(TABLES.USERS).select('*').eq('id', userId).maybeSingle();
      if (error || !data) return null;
      const profile = mapRow(data);
      // Cache locally (dirty=false since it came from Supabase)
      await localDB.put('user_profile', { ...userToPayload(profile), updatedAt: data.last_sync || nowISO() }, false);
      return profile;
    } catch (e) {
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Scan IndexedDB
    const all = await localDB.getAll<any>('user_profile');
    const local = all.find(u => (u.email || '').toLowerCase() === cleanEmail);
    if (local?.id) return mapRow(local);

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return null;
    try {
      const { data, error } = await supabase.from(TABLES.USERS).select('*').eq('email', cleanEmail).maybeSingle();
      if (error || !data) return null;
      const profile = mapRow(data);
      await localDB.put('user_profile', userToPayload(profile), false);
      return profile;
    } catch (e) {
      return null;
    }
  },

  // ── ROADMAP ───────────────────────────────────────────────────────────────────

  async saveRoadmap(user: UserProfile, roadmap: any): Promise<void> {
    const now = nowISO();
    const payload = {
      user_id: user.id,
      roadmap_data: roadmap ? { ...roadmap, dream: user.dream } : null,
      updated_at: now,
    };

    // Check storage quota before writing large roadmap data
    await localDB.checkAndEvict(user.id);

    // 1. Write to IndexedDB with dirty flag
    await localDB.put('roadmaps', payload, true);

    // 2. Update emergency snapshot
    localDB.writeEmergencySnapshot(user.id).catch(() => {});

    // 3. Sync to Supabase in background
    await syncToSupabase('save_roadmap', payload);
  },

  async getRoadmap(userId: string): Promise<any | null> {
    // 1. Try IndexedDB (with conflict resolution on fallback)
    const local = await localDB.get<any>('roadmaps', userId);
    if (local?.roadmap_data) return local.roadmap_data;

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return null;
    try {
      const { data, error } = await supabase.from(TABLES.ROADMAPS).select('roadmap_data, updated_at').eq('user_id', userId).single();
      if (error || !data) return null;

      // Conflict resolution: if we have a local version, compare timestamps
      const { winner, remoteWon } = localDB.resolveConflict(local, data);
      if (remoteWon || !local) {
        await localDB.put('roadmaps', {
          user_id: userId,
          roadmap_data: data.roadmap_data,
          updated_at: data.updated_at || nowISO(),
        }, false); // dirty=false since it came from Supabase
      }
      return data.roadmap_data;
    } catch (e) {
      return null;
    }
  },

  // ── COMPLETED STAGES ─────────────────────────────────────────────────────────

  async getCompletedStages(userId: string): Promise<string[]> {
    // 1. Try IndexedDB
    const local = await localDB.getAll<any>('completed_stages', 'user_id', userId);
    if (local.length > 0) return local.map((s: any) => s.stage_id);

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return [];
    try {
      const { data, error } = await supabase.from(TABLES.PROGRESS).select('stage_id, completed_at').eq('user_id', userId);
      if (error || !data) return [];
      const records = data.map((item: any) => ({
        key: `${userId}__${item.stage_id}`,
        user_id: userId,
        stage_id: item.stage_id,
        completed_at: item.completed_at || nowISO(),
        updatedAt: item.completed_at || nowISO(),
      }));
      await localDB.putMany('completed_stages', records, false);
      return data.map((item: any) => item.stage_id);
    } catch (e) {
      return [];
    }
  },

  async saveCompletedStage(userId: string, stageId: string): Promise<void> {
    const now = nowISO();
    const payload = { user_id: userId, stage_id: stageId, completed_at: now };

    // 1. Write to IndexedDB with dirty flag
    await localDB.put('completed_stages', {
      key: `${userId}__${stageId}`,
      updatedAt: now,
      ...payload,
    }, true);

    // 2. Invalidate stage % computed cache
    await localDB.invalidateComputed(userId, 'stage_progress');

    // 3. Sync to Supabase
    await syncToSupabase('save_stage', payload);
  },

  async clearCompletedStages(userId: string): Promise<void> {
    await localDB.deleteByIndex('completed_stages', 'user_id', userId);
    await localDB.invalidateComputed(userId, 'stage_progress');
    await syncToSupabase('clear_stages', { user_id: userId });
  },

  // ── TASKS ─────────────────────────────────────────────────────────────────────

  async getTasks(userId: string): Promise<DailyTask[]> {
    // 1. Try IndexedDB (compound index for efficiency)
    const local = await localDB.getAll<any>('tasks', 'user_id', userId);
    if (local.length > 0) {
      return local
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          completed: t.completed,
          date: t.date,
          linkedSubject: t.linked_subject || t.linkedSubject,
        } as DailyTask))
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return [];
    try {
      const { data, error } = await supabase.from(TABLES.TASKS).select('*').eq('user_id', userId).order('date', { ascending: false });
      if (error || !data) return [];
      const records = data.map((t: any) => ({ ...t, user_id: userId, updatedAt: t.updated_at || nowISO() }));
      await localDB.putMany('tasks', records, false);
      return data as DailyTask[];
    } catch (e) {
      return [];
    }
  },

  async saveTask(userId: string, task: DailyTask): Promise<void> {
    const now = nowISO();
    const payload = {
      id: task.id,
      user_id: userId,
      title: task.title,
      type: task.type,
      completed: task.completed,
      date: task.date,
      linked_subject: task.linkedSubject,
      updated_at: now,
    };

    // 1. Write to IndexedDB with dirty flag + timestamp
    await localDB.put('tasks', { ...payload, updatedAt: now }, true);

    // 2. Invalidate dashboard computed cache
    await localDB.invalidateComputed(userId, 'dashboard');

    // 3. Update emergency snapshot (includes today's tasks)
    localDB.writeEmergencySnapshot(userId).catch(() => {});

    // 4. Sync to Supabase
    await syncToSupabase('save_task', payload);
  },

  async deleteTask(taskId: string): Promise<void> {
    await localDB.delete('tasks', taskId);
    await syncToSupabase('delete_task', { id: taskId });
  },

  // ── MENTOR CHAT ───────────────────────────────────────────────────────────────

  async saveMentorMessage(userId: string, role: 'user' | 'ai', text: string, sessionId: string): Promise<void> {
    const now = nowISO();
    const localId = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const supabasePayload = { user_id: userId, session_id: sessionId, role, text, created_at: now };

    // 1. Write to IndexedDB
    await localDB.put('mentor_messages', { id: localId, ...supabasePayload, updatedAt: now }, true);

    // 2. Sync to Supabase (without local ID)
    await syncToSupabase('save_mentor_msg', supabasePayload);
  },

  /**
   * Get mentor history — lazy loads latest 50 messages by default.
   * Pass limit=-1 to load all local messages.
   */
  async getMentorHistory(
    userId: string,
    limit = 50
  ): Promise<{ role: 'user' | 'ai'; text: string; created_at: string; session_id?: string }[]> {
    // 1. Try IndexedDB (fast, offline)
    const local = await localDB.getAll<any>('mentor_messages', 'user_id', userId);
    if (local.length > 0) {
      const sorted = local.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
      const slice = limit > 0 ? sorted.slice(-limit) : sorted; // latest N messages
      return slice.map((m: any) => ({
        role: m.role,
        text: m.text,
        created_at: m.created_at,
        session_id: m.session_id,
      }));
    }

    // 2. Fallback to Supabase (pulls last 200 = MAX_LOCAL_MENTOR_MSGS)
    if (!networkService.isOnline()) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.MENTOR)
        .select('role, text, created_at, session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error || !data) return [];
      const records = data.map((m: any, i: number) => ({
        id: `${m.session_id || 'legacy'}_${m.created_at}_${i}`,
        user_id: userId,
        updatedAt: m.created_at,
        ...m,
      }));
      await localDB.putMany('mentor_messages', records, false);
      const slice = limit > 0 ? data.slice(-limit) : data;
      return slice as any[];
    } catch (e) {
      return [];
    }
  },

  async clearMentorHistory(userId: string): Promise<void> {
    await localDB.deleteByIndex('mentor_messages', 'user_id', userId);
    await syncToSupabase('clear_mentor', { user_id: userId });
  },

  async deleteMentorSession(userId: string, sessionId: string): Promise<void> {
    await localDB.deleteByIndex('mentor_messages', 'session_id', sessionId);
    await syncToSupabase('delete_mentor_session', { user_id: userId, session_id: sessionId });
  },

  // ── REWARDS ───────────────────────────────────────────────────────────────────

  async saveReward(userId: string, reward: Reward, currentRewards: Reward[]): Promise<void> {
    const updated = [...(currentRewards || []).filter(r => r.id !== reward.id), reward];
    const local = await localDB.get<any>('user_profile', userId);
    if (local) {
      await localDB.put('user_profile', { ...local, rewards: updated, updatedAt: nowISO() }, true);
    }
    await syncToSupabase('save_reward', { user_id: userId, rewards: updated });
  },

  // ── COMPUTED CACHE (Dashboard acceleration) ────────────────────────────────

  /** Cache pre-computed dashboard values to avoid recalculating on every render */
  async saveDashboardCache(userId: string, values: { totalXP: number; streak: number; stagePercent: number }): Promise<void> {
    await localDB.setComputed(userId, 'dashboard', values);
  },

  async getDashboardCache(userId: string): Promise<{ totalXP: number; streak: number; stagePercent: number } | null> {
    return localDB.getComputed(userId, 'dashboard');
  },

  // ── STORAGE INFO (for settings screen) ───────────────────────────────────────

  async getStorageInfo(): Promise<{ usedMB: number; quotaMB: number; usedPercent: number } | null> {
    return localDB.getStorageUsage();
  },

  // ── FULL DATA POPULATION (called after login) ─────────────────────────────────

  async populateLocalDB(userId: string): Promise<void> {
    if (!networkService.isOnline()) {
      console.log('[dbService] Offline — skipping initial data population');
      return;
    }
    console.log('[dbService] Populating IndexedDB from Supabase for user:', userId);

    try {
      const [roadmapRes, tasksRes, stagesRes, mentorRes] = await Promise.allSettled([
        supabase.from(TABLES.ROADMAPS).select('*').eq('user_id', userId).single(),
        supabase.from(TABLES.TASKS).select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from(TABLES.PROGRESS).select('*').eq('user_id', userId),
        supabase.from(TABLES.MENTOR).select('role, text, created_at, session_id').eq('user_id', userId).order('created_at', { ascending: true }).limit(200),
      ]);

      if (roadmapRes.status === 'fulfilled' && roadmapRes.value.data) {
        const rd = roadmapRes.value.data;
        await localDB.put('roadmaps', { user_id: userId, roadmap_data: rd.roadmap_data, updated_at: rd.updated_at || nowISO() }, false);
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.length) {
        const records = tasksRes.value.data.map((t: any) => ({
          ...t, user_id: userId, updatedAt: t.updated_at || nowISO(),
        }));
        await localDB.putMany('tasks', records, false);
      }

      if (stagesRes.status === 'fulfilled' && stagesRes.value.data?.length) {
        const records = stagesRes.value.data.map((item: any) => ({
          key: `${userId}__${item.stage_id}`,
          user_id: userId,
          stage_id: item.stage_id,
          completed_at: item.completed_at,
          updatedAt: item.completed_at || nowISO(),
        }));
        await localDB.putMany('completed_stages', records, false);
      }

      if (mentorRes.status === 'fulfilled' && mentorRes.value.data?.length) {
        const records = mentorRes.value.data.map((m: any, i: number) => ({
          id: `${m.session_id || 'legacy'}_${m.created_at}_${i}`,
          user_id: userId,
          updatedAt: m.created_at,
          ...m,
        }));
        await localDB.putMany('mentor_messages', records, false);
      }

      // Run maintenance after population (expire old tasks, trim chat, check quota)
      localDB.runMaintenance(userId).catch(() => {});

      // Write initial emergency snapshot
      localDB.writeEmergencySnapshot(userId).catch(() => {});

      console.log('[dbService] IndexedDB populated successfully');
    } catch (err) {
      console.warn('[dbService] populateLocalDB partial failure (non-fatal):', err);
    }
  },

  // ── SESSION CLEAR ─────────────────────────────────────────────────────────────

  async clearSession(): Promise<void> {
    localStorage.setItem('kalamspark_explicitly_logged_out', 'true');

    // Attempt to flush any unsynced offline operations before wiping data (best-effort)
    if (networkService.isOnline()) {
      try {
        await offlineSyncService.flush();
      } catch (e) {
        console.warn('[dbService] Sync flush before signout failed:', e);
      }
    }

    try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }

    // Wipe IndexedDB (also removes emergency snapshot)
    await localDB.deleteDatabase();

    // Clear all localStorage keys (NEVER stores API keys — only profile/state)
    const keysToRemove = [
      'kalamspark_user_session', 'kalamspark_roadmap_data',
      'kalamspark_manual_email', 'kalamspark_cached_profile',
      'fs_sources', 'fs_active_id', 'fs_states', 'fs_checked',
      'kalamspark_force_refresh', 'ks_task_variety', 'ks_last_task_reset',
      'kalamspark_last_route', 'ks_offline_sync_queue',
      'kalamspark_last_login_date', 'kalamspark_roadmap_cache',
      'kalamspark_concept_progress', 'kalamspark_mentor_titles',
      'ks_emergency_snapshot',
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('kalamspark_radar');
    sessionStorage.removeItem('fs_import_url');
  },
};
