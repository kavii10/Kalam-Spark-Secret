/**
 * Task Revision Service
 * Auto-schedules completed tasks for spaced repetition revision.
 * FSRS is used for scheduling; quiz scores auto-determine the grade.
 */

import { supabase } from "./supabaseClient";

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
      // Use maybeSingle to avoid error if no row exists
      const { data: existing, error: checkError } = await supabase
        .from("task_revisions")
        .select("id")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing revision:", checkError);
      }
      if (existing) {
        console.log("Task already in revision queue:", taskTitle);
        return;
      }

      const now = new Date();
      // Use the actual task ID or a stable generated one
      const rowId = `tr_${userId.slice(0,5)}_${taskId}`; 
      
      const { error } = await supabase.from("task_revisions").upsert({
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
      }, { onConflict: 'id' });

      if (error) {
        console.error("Error enqueueing task revision:", error);
      } else {
        console.log("Successfully enqueued task for revision:", taskTitle);
      }
    } catch (e) {
      console.error("Unexpected error in enqueueTask:", e);
    }
  }

  /** Get tasks due for review now */
  async getDueTasks(userId: string): Promise<TaskRevision[]> {
    const now = new Date();
    const { data, error } = await supabase
      .from("task_revisions")
      .select("*")
      .eq("user_id", userId)
      .lte("next_review", now.toISOString())
      .order("next_review", { ascending: true });

    if (error) { console.error(error); return []; }
    return (data || []).map(this.mapRow);
  }

  /** Get ALL revisions for calendar / analytics */
  async getAllRevisions(userId: string): Promise<TaskRevision[]> {
    const { data, error } = await supabase
      .from("task_revisions")
      .select("*")
      .eq("user_id", userId)
      .order("next_review", { ascending: true });

    if (error) { console.error(error); return []; }
    return (data || []).map(this.mapRow);
  }

  /** Update revision after a quiz. scorePercent = 0-100 */
  async recordReview(revisionId: string, scorePercent: number): Promise<void> {
    const { data, error } = await supabase
      .from("task_revisions")
      .select("*")
      .eq("id", revisionId)
      .single();

    if (error || !data) return;

    const grade = scoreToGrade(scorePercent);
    const interval = this.fsrsInterval(data.stability, data.difficulty, grade);
    const newStability = this.fsrsStability(data.stability, grade, interval);
    const newDifficulty = this.fsrsDifficulty(data.difficulty, grade);
    const now = new Date();

    await supabase.from("task_revisions").update({
      stability: newStability,
      difficulty: newDifficulty,
      repetition_count: data.repetition_count + 1,
      next_review: this.addDays(now, interval).toISOString(),
      last_review: now.toISOString(),
      last_quiz_score: scorePercent,
      total_reviews: data.total_reviews + 1,
    }).eq("id", revisionId);
  }

  private mapRow = (r: any): TaskRevision => ({
    id: r.id,
    userId: r.user_id,
    taskId: r.task_id,
    taskTitle: r.task_title,
    taskType: r.task_type,
    stability: r.stability,
    difficulty: r.difficulty,
    repetitionCount: r.repetition_count,
    nextReview: new Date(r.next_review),
    lastReview: r.last_review ? new Date(r.last_review) : null,
    lastQuizScore: r.last_quiz_score,
    totalReviews: r.total_reviews,
    createdAt: new Date(r.created_at),
  });
}

export const taskRevisionService = new TaskRevisionService();
