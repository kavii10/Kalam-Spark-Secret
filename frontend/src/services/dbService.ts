/**
 * dbService — Kalam Spark Local-First Data Service
 *
 * Architecture: Every operation writes to IndexedDB FIRST (instant, offline-capable),
 * then syncs to Supabase in the background. Reads come from IndexedDB first,
 * falling back to Supabase only when the local store is empty.
 *
 * This makes the app work exactly like WhatsApp:
 *   • App opens offline  → shows all data instantly from IndexedDB
 *   • Write while offline → stored locally, queued for Supabase sync
 *   • Back online        → auto-syncs all pending changes to Supabase
 *   • Write while online → stored locally AND synced to Supabase immediately
 */

import { UserProfile, DailyTask, Reward } from '../types';
import { supabase } from './supabaseClient';
import { networkService } from './networkService';
import { offlineSyncService, SyncOpType } from './offlineSyncService';
import { localDB } from './localDB';

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

// ─── Row → UserProfile mapper ─────────────────────────────────────────────────
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
    educationLevel: data.education_level || '',
    schoolBoard: data.school_board || '',
    gradeOrSemester: data.grade_or_semester || '',
    collegeName: data.college_name || '',
    studyHoursPerDay: data.study_hours_per_day ?? undefined,
    targetYear: data.target_year || '',
    city: data.city || '',
    motivation: data.motivation || '',
    dream: data.dream || '',
    currentStageIndex: data.current_stage_index ?? 0,
    onboardingComplete: data.onboarding_complete ?? false,
    isAuthenticated: true,
    xp: data.xp ?? 0,
    streak: data.streak ?? 0,
    rewards: data.rewards ?? [],
    settings: data.settings ? { ...defaultSettings, ...data.settings } : defaultSettings,
    fileSpeakerData: data.file_speaker_data || {
      sources: [],
      activeId: null,
      states: {},
      checked: [],
    },
  };
}

// ─── UserProfile → Supabase Payload mapper ────────────────────────────────────
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
    last_sync: new Date().toISOString(),
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
// Fire-and-forget: tries Supabase immediately; if offline or fails → queues for retry
function syncToSupabase(type: SyncOpType, payload: any): void {
  if (networkService.isOnline()) {
    offlineSyncService.executeOne(type, payload).catch(() => {
      // Supabase call failed (flaky network) — queue for retry
      offlineSyncService.enqueue(type, payload);
    });
  } else {
    offlineSyncService.enqueue(type, payload);
  }
}

// ─── dbService ────────────────────────────────────────────────────────────────
export const dbService = {

  // ── USER PROFILE ─────────────────────────────────────────────────────────────

  async saveUser(user: UserProfile): Promise<void> {
    // 1. Write to IndexedDB immediately (never blocked by network)
    const localRecord = { ...user, _localUpdatedAt: new Date().toISOString() };
    await localDB.put('user_profile', localRecord);

    // 2. Also keep the legacy localStorage cache in sync (for the fast startup path)
    try {
      localStorage.setItem('kalamspark_cached_profile', JSON.stringify({ ...user, isAuthenticated: true }));
    } catch (e) { /* localStorage might be full */ }

    // 3. Sync to Supabase in background
    const payload = userToPayload(user);
    syncToSupabase('save_user', payload);
  },

  async getUser(userId: string): Promise<UserProfile | null> {
    // 1. Try IndexedDB first
    const local = await localDB.get<any>('user_profile', userId);
    if (local?.id) return mapRow({ ...local, onboarding_complete: local.onboardingComplete ?? local.onboarding_complete });

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return null;
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data) return null;
      const profile = mapRow(data);
      // Cache in IndexedDB for offline use
      await localDB.put('user_profile', { ...userToPayload(profile), id: profile.id });
      return profile;
    } catch (e) {
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Scan IndexedDB (user_profile has no email index, so getAll and filter)
    const all = await localDB.getAll<any>('user_profile');
    const local = all.find(u => (u.email || '').toLowerCase() === cleanEmail);
    if (local?.id) return mapRow({ ...local, onboarding_complete: local.onboardingComplete ?? local.onboarding_complete });

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return null;
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (error || !data) return null;
      const profile = mapRow(data);
      await localDB.put('user_profile', userToPayload(profile));
      return profile;
    } catch (e) {
      return null;
    }
  },

  // ── ROADMAP ───────────────────────────────────────────────────────────────────

  async saveRoadmap(user: UserProfile, roadmap: any): Promise<void> {
    const payload = {
      user_id: user.id,
      roadmap_data: roadmap ? { ...roadmap, dream: user.dream } : null,
      updated_at: new Date().toISOString(),
    };

    // 1. Write to IndexedDB immediately
    await localDB.put('roadmaps', payload);

    // 2. Sync to Supabase in background
    syncToSupabase('save_roadmap', payload);
  },

  async getRoadmap(userId: string): Promise<any | null> {
    // 1. Try IndexedDB first
    const local = await localDB.get<any>('roadmaps', userId);
    if (local?.roadmap_data) return local.roadmap_data;

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return null;
    try {
      const { data, error } = await supabase
        .from(TABLES.ROADMAPS)
        .select('roadmap_data')
        .eq('user_id', userId)
        .single();
      if (error || !data) return null;
      // Cache in IndexedDB
      await localDB.put('roadmaps', { user_id: userId, roadmap_data: data.roadmap_data, updated_at: new Date().toISOString() });
      return data.roadmap_data;
    } catch (e) {
      return null;
    }
  },

  // ── COMPLETED STAGES ─────────────────────────────────────────────────────────

  async getCompletedStages(userId: string): Promise<string[]> {
    // 1. Try IndexedDB first
    const local = await localDB.getAll<any>('completed_stages', 'user_id', userId);
    if (local.length > 0) return local.map((s: any) => s.stage_id);

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.PROGRESS)
        .select('stage_id')
        .eq('user_id', userId);
      if (error || !data) return [];
      // Cache in IndexedDB
      const records = data.map((item: any) => ({
        key: `${userId}__${item.stage_id}`,
        user_id: userId,
        stage_id: item.stage_id,
        completed_at: item.completed_at || new Date().toISOString(),
      }));
      await localDB.putMany('completed_stages', records);
      return data.map((item: any) => item.stage_id);
    } catch (e) {
      return [];
    }
  },

  async saveCompletedStage(userId: string, stageId: string): Promise<void> {
    const payload = {
      user_id: userId,
      stage_id: stageId,
      completed_at: new Date().toISOString(),
    };

    // 1. Write to IndexedDB immediately
    await localDB.put('completed_stages', {
      key: `${userId}__${stageId}`,
      ...payload,
    });

    // 2. Sync to Supabase in background
    syncToSupabase('save_stage', payload);
  },

  async clearCompletedStages(userId: string): Promise<void> {
    // 1. Clear from IndexedDB immediately
    await localDB.deleteByIndex('completed_stages', 'user_id', userId);

    // 2. Sync to Supabase in background
    syncToSupabase('clear_stages', { user_id: userId });
  },

  // ── TASKS ─────────────────────────────────────────────────────────────────────

  async getTasks(userId: string): Promise<DailyTask[]> {
    // 1. Try IndexedDB first
    const local = await localDB.getAll<any>('tasks', 'user_id', userId);
    if (local.length > 0) {
      return local
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          completed: t.completed,
          date: t.date,
          linkedSubject: t.linked_subject,
        } as DailyTask))
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.TASKS)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (error || !data) return [];
      // Cache in IndexedDB
      const records = data.map((t: any) => ({ ...t, user_id: userId }));
      await localDB.putMany('tasks', records);
      return data as DailyTask[];
    } catch (e) {
      return [];
    }
  },

  async saveTask(userId: string, task: DailyTask): Promise<void> {
    const payload = {
      id: task.id,
      user_id: userId,
      title: task.title,
      type: task.type,
      completed: task.completed,
      date: task.date,
      linked_subject: task.linkedSubject,
    };

    // 1. Write to IndexedDB immediately
    await localDB.put('tasks', payload);

    // 2. Sync to Supabase in background
    syncToSupabase('save_task', payload);
  },

  async deleteTask(taskId: string): Promise<void> {
    // 1. Delete from IndexedDB immediately
    await localDB.delete('tasks', taskId);

    // 2. Sync to Supabase in background
    syncToSupabase('delete_task', { id: taskId });
  },

  // ── MENTOR CHAT ───────────────────────────────────────────────────────────────

  async saveMentorMessage(
    userId: string,
    role: 'user' | 'ai',
    text: string,
    sessionId: string
  ): Promise<void> {
    const now = new Date().toISOString();
    // Generate a local ID for IndexedDB (Supabase table has no explicit id column)
    const localId = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const supabasePayload = {
      user_id: userId,
      session_id: sessionId,
      role,
      text,
      created_at: now,
    };

    // 1. Write to IndexedDB immediately (with local id)
    await localDB.put('mentor_messages', { id: localId, ...supabasePayload });

    // 2. Sync to Supabase in background (without the local id)
    syncToSupabase('save_mentor_msg', supabasePayload);
  },

  async getMentorHistory(
    userId: string
  ): Promise<{ role: 'user' | 'ai'; text: string; created_at: string; session_id?: string }[]> {
    // 1. Try IndexedDB first
    const local = await localDB.getAll<any>('mentor_messages', 'user_id', userId);
    if (local.length > 0) {
      return local
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .map((m: any) => ({
          role: m.role,
          text: m.text,
          created_at: m.created_at,
          session_id: m.session_id,
        }));
    }

    // 2. Fallback to Supabase
    if (!networkService.isOnline()) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.MENTOR)
        .select('role, text, created_at, session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error || !data) return [];
      // Cache in IndexedDB (assign synthetic local ids)
      const records = data.map((m: any, i: number) => ({
        id: `${m.session_id || 'legacy'}_${m.created_at}_${i}`,
        user_id: userId,
        ...m,
      }));
      await localDB.putMany('mentor_messages', records);
      return data as any[];
    } catch (e) {
      return [];
    }
  },

  async clearMentorHistory(userId: string): Promise<void> {
    // 1. Clear from IndexedDB immediately
    await localDB.deleteByIndex('mentor_messages', 'user_id', userId);

    // 2. Sync to Supabase in background
    syncToSupabase('clear_mentor', { user_id: userId });
  },

  async deleteMentorSession(userId: string, sessionId: string): Promise<void> {
    // 1. Delete from IndexedDB immediately
    await localDB.deleteByIndex('mentor_messages', 'session_id', sessionId);

    // 2. Sync to Supabase in background
    syncToSupabase('delete_mentor_session', { user_id: userId, session_id: sessionId });
  },

  // ── REWARDS ───────────────────────────────────────────────────────────────────

  async saveReward(userId: string, reward: Reward, currentRewards: Reward[]): Promise<void> {
    const updated = [...(currentRewards || []).filter(r => r.id !== reward.id), reward];

    // 1. Update the user record in IndexedDB immediately
    const local = await localDB.get<any>('user_profile', userId);
    if (local) {
      await localDB.put('user_profile', { ...local, rewards: updated });
    }

    // 2. Sync to Supabase in background
    syncToSupabase('save_reward', { user_id: userId, rewards: updated });
  },

  // ── FULL DATA POPULATION (called after login to populate IndexedDB from Supabase) ─────

  /**
   * Pull all user data from Supabase and store in IndexedDB.
   * Called once after a successful login (online) to ensure IndexedDB is populated.
   * This enables full offline access immediately on the next app open.
   */
  async populateLocalDB(userId: string): Promise<void> {
    if (!networkService.isOnline()) {
      console.log('[dbService] Offline — skipping initial data population');
      return;
    }
    console.log('[dbService] Populating local IndexedDB from Supabase for user:', userId);

    try {
      // Pull all data in parallel
      const [roadmapRes, tasksRes, stagesRes, mentorRes] = await Promise.allSettled([
        supabase.from(TABLES.ROADMAPS).select('*').eq('user_id', userId).single(),
        supabase.from(TABLES.TASKS).select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from(TABLES.PROGRESS).select('*').eq('user_id', userId),
        supabase.from(TABLES.MENTOR).select('role, text, created_at, session_id').eq('user_id', userId).order('created_at', { ascending: true }).limit(500),
      ]);

      // Store roadmap
      if (roadmapRes.status === 'fulfilled' && roadmapRes.value.data) {
        await localDB.put('roadmaps', {
          user_id: userId,
          roadmap_data: roadmapRes.value.data.roadmap_data,
          updated_at: roadmapRes.value.data.updated_at || new Date().toISOString(),
        });
      }

      // Store tasks
      if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.length) {
        await localDB.putMany('tasks', tasksRes.value.data);
      }

      // Store completed stages
      if (stagesRes.status === 'fulfilled' && stagesRes.value.data?.length) {
        const records = stagesRes.value.data.map((item: any) => ({
          key: `${userId}__${item.stage_id}`,
          user_id: userId,
          stage_id: item.stage_id,
          completed_at: item.completed_at,
        }));
        await localDB.putMany('completed_stages', records);
      }

      // Store mentor messages
      if (mentorRes.status === 'fulfilled' && mentorRes.value.data?.length) {
        const records = mentorRes.value.data.map((m: any, i: number) => ({
          id: `${m.session_id || 'legacy'}_${m.created_at}_${i}`,
          user_id: userId,
          ...m,
        }));
        await localDB.putMany('mentor_messages', records);
      }

      console.log('[dbService] Local IndexedDB populated successfully');
    } catch (err) {
      console.warn('[dbService] populateLocalDB partial failure (non-fatal):', err);
    }
  },

  // ── SESSION CLEAR ─────────────────────────────────────────────────────────────

  async clearSession(): Promise<void> {
    // Mark as explicit logout
    localStorage.setItem('kalamspark_explicitly_logged_out', 'true');

    // Sign out from Supabase Auth
    try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }

    // Wipe IndexedDB completely
    await localDB.deleteDatabase();

    // Clear all localStorage keys
    const keysToRemove = [
      'kalamspark_user_session', 'kalamspark_roadmap_data',
      'kalamspark_manual_email', 'kalamspark_cached_profile',
      'fs_sources', 'fs_active_id', 'fs_states', 'fs_checked',
      'kalamspark_force_refresh', 'ks_task_variety', 'ks_last_task_reset',
      'kalamspark_last_route', 'ks_offline_sync_queue',
      'kalamspark_last_login_date', 'kalamspark_roadmap_cache',
      'kalamspark_concept_progress', 'kalamspark_mentor_titles',
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('kalamspark_radar');
    sessionStorage.removeItem('fs_import_url');
  },
};
