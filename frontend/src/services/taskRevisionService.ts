/**
 * Task Revision Service
 * Auto-schedules completed tasks for spaced repetition revision.
 * FSRS is used for scheduling; quiz scores auto-determine the grade.
 */

import { supabase } from "./supabaseClient";
import { localDB, DEVICE_ID } from "./localDB";
import { networkService } from "./networkService";
import { offlineSyncService, SyncOpType } from "./offlineSyncService";

async function syncToSupabase(type: SyncOpType, payload: any): Promise<void> {
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

export interface TaskRevision {
  id: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  /** FSRS fields */
  stability: number;
  difficulty: number;
  repetitionCount: number;
  nextReview: Date;
  lastReview: Date | null;
  lastQuizScore: number | null; // 0-100%
  totalReviews: number;
  createdAt: Date;
}

/** Convert quiz score % → FSRS grade 1-4 */
export function scoreToGrade(scorePercent: number): 1 | 2 | 3 | 4 {
  if (scorePercent >= 90) return 4; // Easy
  if (scorePercent >= 65) return 3; // Good
  if (scorePercent >= 40) return 2; // Hard
  return 1;                          // Again
}

class TaskRevisionService {
  // ── FSRS core constants ──
  private readonly DECAY = -0.5;
  private readonly FACTOR = 19 / 81;
  private readonly RETENTION = 0.9;

  private fsrsInterval(stability: number, difficulty: number, grade: 1 | 2 | 3 | 4): number {
    if (grade === 1) return 1;
    const base = Math.pow(this.RETENTION, 1 / (this.FACTOR * difficulty));
    const multiplier = grade === 2 ? 1.2 : grade === 3 ? 1.0 : 1.3;
    return Math.max(1, Math.ceil(stability * base * multiplier));
  }

  private fsrsStability(stability: number, grade: 1 | 2 | 3 | 4, interval: number): number {
    if (grade === 1) return Math.max(1, stability * 0.96 - 0.14);
    const factor = grade === 2 ? 0.96 : grade === 3 ? 1.0 : 1.3;
    return Math.max(1, stability * (factor + this.DECAY * Math.log(interval)));
  }

  private fsrsDifficulty(difficulty: number, grade: 1 | 2 | 3 | 4): number {
    const changes = [-0.14, -0.14, 0, 0.1];
    const nd = difficulty + changes[grade - 1] * (8 - 2 * difficulty) / 17;
    return Math.max(1, Math.min(10, 0.9 * nd + 0.5));
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  /** Enqueue a newly completed task for revision */
  async enqueueTask(userId: string, taskId: string, taskTitle: string, taskType: string): Promise<void> {
    try {
      const rowId = `tr_${userId.slice(0,5)}_${taskId}`;

      // Check locally in IndexedDB first
      const localExisting = await localDB.get('task_revisions', rowId);
      if (localExisting) {
        console.log("Task already in revision queue:", taskTitle);
        return;
      }

      const now = new Date();
      const localPayload = {
        id: rowId,
        user_id: userId,
        task_id: taskId,
        task_title: taskTitle,
        task_type: taskType || 'theory',
        stability: 1.0,
        difficulty: 5.0,
        repetition_count: 0,
        next_review: this.addDays(now, 1).toISOString(),
        last_review: null,
        last_quiz_score: null,
        total_reviews: 0,
        created_at: now.toISOString(),
      };

      // 1. Write to local IndexedDB
      await localDB.put('task_revisions', localPayload, true);

      // 2. Sync to Supabase in background
      await syncToSupabase('save_task_revision', localPayload);
      console.log("Successfully enqueued task for revision:", taskTitle);
    } catch (e) {
      console.error("Unexpected error in enqueueTask:", e);
    }
  }

  /** Get tasks due for review now */
  async getDueTasks(userId: string): Promise<TaskRevision[]> {
    if (networkService.isOnline()) {
      try {
        const now = new Date();
        const { data, error } = await supabase
          .from("task_revisions")
          .select("*")
          .eq("user_id", userId)
          .lte("next_review", now.toISOString())
          .order("next_review", { ascending: true });

        if (!error && data) {
          await localDB.putMany('task_revisions', data, false);
        }
      } catch (e) {
        console.warn("[TaskRevisionService] Error pre-fetching due tasks from Supabase, falling back to local:", e);
      }
    }

    // Load from local IndexedDB
    const allLocal = await localDB.getAll<any>('task_revisions', 'user_id', userId);
    const now = new Date();
    const due = allLocal.filter(r => new Date(r.next_review || r.nextReview) <= now);
    
    // Sort by next_review ascending
    due.sort((a, b) => new Date(a.next_review || a.nextReview).getTime() - new Date(b.next_review || b.nextReview).getTime());
    return due.map(this.mapRow);
  }

  /** Get ALL revisions for calendar / analytics */
  async getAllRevisions(userId: string): Promise<TaskRevision[]> {
    if (networkService.isOnline()) {
      try {
        const { data, error } = await supabase
          .from("task_revisions")
          .select("*")
          .eq("user_id", userId)
          .order("next_review", { ascending: true });

        if (!error && data) {
          await localDB.putMany('task_revisions', data, false);
        }
      } catch (e) {
        console.warn("[TaskRevisionService] Error pre-fetching all revisions from Supabase, falling back to local:", e);
      }
    }

    // Load from local IndexedDB
    const allLocal = await localDB.getAll<any>('task_revisions', 'user_id', userId);
    allLocal.sort((a, b) => new Date(a.next_review || a.nextReview).getTime() - new Date(b.next_review || b.nextReview).getTime());
    return allLocal.map(this.mapRow);
  }

  /** Update revision after a quiz. scorePercent = 0-100 */
  async recordReview(revisionId: string, scorePercent: number): Promise<void> {
    try {
      const local = await localDB.get<any>('task_revisions', revisionId);
      if (!local) return;

      const grade = scoreToGrade(scorePercent);
      const interval = this.fsrsInterval(local.stability, local.difficulty, grade);
      const newStability = this.fsrsStability(local.stability, grade, interval);
      const newDifficulty = this.fsrsDifficulty(local.difficulty, grade);
      const now = new Date();

      const updatedPayload = {
        ...local,
        stability: newStability,
        difficulty: newDifficulty,
        repetition_count: (local.repetition_count !== undefined ? local.repetition_count : local.repetitionCount) + 1,
        next_review: this.addDays(now, interval).toISOString(),
        last_review: now.toISOString(),
        last_quiz_score: scorePercent,
        total_reviews: (local.total_reviews !== undefined ? local.total_reviews : local.totalReviews) + 1,
      };

      // 1. Write to local IndexedDB
      await localDB.put('task_revisions', updatedPayload, true);

      // 2. Sync to Supabase in background
      await syncToSupabase('save_task_revision', updatedPayload);
    } catch (e) {
      console.error("Error in recordReview:", e);
    }
  }

  private mapRow = (r: any): TaskRevision => ({
    id: r.id,
    userId: r.user_id || r.userId,
    taskId: r.task_id || r.taskId,
    taskTitle: r.task_title || r.taskTitle,
    taskType: r.task_type || r.taskType,
    stability: r.stability,
    difficulty: r.difficulty,
    repetitionCount: r.repetition_count !== undefined ? r.repetition_count : r.repetitionCount,
    nextReview: new Date(r.next_review || r.nextReview),
    lastReview: (r.last_review || r.lastReview) ? new Date(r.last_review || r.lastReview) : null,
    lastQuizScore: r.last_quiz_score !== undefined ? r.last_quiz_score : r.lastQuizScore,
    totalReviews: r.total_reviews !== undefined ? r.total_reviews : r.totalReviews,
    createdAt: new Date(r.created_at || r.createdAt),
  });
}

export const taskRevisionService = new TaskRevisionService();
