/**
 * OfflineSyncService — Kalam Spark
 *
 * Stores the sync queue in IndexedDB (via localDB) for reliability.
 * Listens for network restoration and auto-flushes all pending operations.
 *
 * Supported operations:
 *   save_user             — UserProfile upsert
 *   save_task             — DailyTask upsert
 *   delete_task           — DailyTask delete by id
 *   save_stage            — CompletedStage insert
 *   clear_stages          — Delete all completed stages for a user
 *   save_roadmap          — Roadmap upsert
 *   save_mentor_msg       — Mentor chat message insert
 *   clear_mentor          — Clear all mentor messages for a user
 *   delete_mentor_session — Delete all messages in a session
 *   save_reward           — Update rewards array on user row
 */

import { supabase } from './supabaseClient';
import { localDB } from './localDB';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { networkService } from './networkService';

// ── Types ─────────────────────────────────────────────────────────────────────
export type SyncOpType =
  | 'save_user'
  | 'save_task'
  | 'delete_task'
  | 'save_stage'
  | 'delete_stage'
  | 'clear_stages'
  | 'save_roadmap'
  | 'save_mentor_msg'
  | 'clear_mentor'
  | 'delete_mentor_session'
  | 'save_reward'
  | 'save_flashcard'
  | 'save_flashcard_stats'
  | 'delete_flashcard';

export interface SyncOperation {
  id: string;
  type: SyncOpType;
  payload: any;
  createdAt: string;
  retries: number;
}

const MAX_RETRIES = 5;

// ── Core Service ──────────────────────────────────────────────────────────────
class OfflineSyncService {
  private isFlushing = false;
  private listeners: Array<(count: number) => void> = [];

  constructor() {
    this._startNetworkListener();
    // Migrate legacy localStorage queue to IndexedDB on first run
    this._migrateLegacyQueue();
  }

  // ── Queue Size Subscription ─────────────────────────────────────────────────

  onQueueChange(cb: (count: number) => void): () => void {
    this.listeners.push(cb);
    // Emit current count immediately (async)
    localDB.getSyncQueueCount().then(count => cb(count));
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private async _emit(): Promise<void> {
    const count = await localDB.getSyncQueueCount();
    this.listeners.forEach(cb => cb(count));
  }

  async getPendingCount(): Promise<number> {
    return localDB.getSyncQueueCount();
  }

  // ── Enqueue ──────────────────────────────────────────────────────────────────

  /**
   * Add an operation to the sync queue.
   * Automatically deduplicates save_user, save_roadmap (last write wins).
   */
  async enqueue(type: SyncOpType, payload: any): Promise<void> {
    const queue = await localDB.getSyncQueue();

    // Deduplication: for these types, remove existing ops of the same type
    const dedupeByType: SyncOpType[] = ['save_user', 'save_roadmap', 'clear_stages', 'clear_mentor'];
    if (dedupeByType.includes(type)) {
      // Remove old ops of same type so only latest survives
      const old = queue.filter(op => op.type === type);
      for (const op of old) {
        await localDB.dequeueSyncOp(op.id);
      }
    }

    // Dedup save_task by task id
    if (type === 'save_task' && payload?.id) {
      const old = queue.find(op => op.type === 'save_task' && op.payload?.id === payload.id);
      if (old) await localDB.dequeueSyncOp(old.id);
    }

    // Dedup delete_task by task id
    if (type === 'delete_task' && payload?.id) {
      // If we have a pending save_task for the same id, remove it (delete wins)
      const oldSave = queue.find(op => op.type === 'save_task' && op.payload?.id === payload.id);
      if (oldSave) await localDB.dequeueSyncOp(oldSave.id);
    }

    // Dedup save_flashcard by card id
    if (type === 'save_flashcard' && payload?.id) {
      const old = queue.find(op => op.type === 'save_flashcard' && op.payload?.id === payload.id);
      if (old) await localDB.dequeueSyncOp(old.id);
    }

    // Dedup save_flashcard_stats by stats id or flashcard id
    if (type === 'save_flashcard_stats' && payload?.id) {
      const old = queue.find(op => op.type === 'save_flashcard_stats' && op.payload?.id === payload.id);
      if (old) await localDB.dequeueSyncOp(old.id);
    }

    // Dedup delete_flashcard by card id
    if (type === 'delete_flashcard' && payload?.id) {
      const oldSave = queue.find(op => op.type === 'save_flashcard' && op.payload?.id === payload.id);
      if (oldSave) await localDB.dequeueSyncOp(oldSave.id);
    }

    // Dedup delete_mentor_session by session_id
    if (type === 'delete_mentor_session' && payload?.session_id) {
      const old = queue.find(op => op.type === 'delete_mentor_session' && op.payload?.session_id === payload.session_id);
      if (old) await localDB.dequeueSyncOp(old.id);
    }

    const op: SyncOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    };

    await localDB.enqueueSync(op);
    await this._emit();
    console.log(`[OfflineSync] Queued "${type}" — pending: ${await localDB.getSyncQueueCount()}`);

    if (networkService.isOnline()) {
      this.flush().catch(err => console.error("[OfflineSync] Auto-flush failed:", err));
    }
  }

  // ── Execute One (called by dbService for immediate background sync) ──────────

  /** Execute a single operation against Supabase immediately (no queuing). Throws on failure. */
  async executeOne(type: SyncOpType, payload: any): Promise<void> {
    await this._executeOp({ id: 'immediate', type, payload, createdAt: '', retries: 0 });
  }

  // ── Flush All Queued Ops ─────────────────────────────────────────────────────

  async flush(): Promise<void> {
    if (this.isFlushing) return;
    const queue = await localDB.getSyncQueue();
    if (queue.length === 0) return;

    this.isFlushing = true;
    console.log(`[OfflineSync] Flushing ${queue.length} pending operations...`);

    let successCount = 0;
    let failCount = 0;

    for (const op of queue) {
      try {
        await this._executeOp(op);
        await localDB.dequeueSyncOp(op.id);
        successCount++;
        console.log(`[OfflineSync] ✅ "${op.type}" synced`);
      } catch (err: any) {
        op.retries = (op.retries || 0) + 1;
        if (op.retries < MAX_RETRIES) {
          // Update retry count in queue
          await localDB.enqueueSync(op);
          failCount++;
          console.warn(`[OfflineSync] ⚠️ "${op.type}" failed (attempt ${op.retries}):`, err?.message);
        } else {
          // Exhausted retries — drop it
          await localDB.dequeueSyncOp(op.id);
          console.error(`[OfflineSync] ❌ "${op.type}" dropped after ${MAX_RETRIES} retries`);
        }
      }
    }

    await this._emit();
    this.isFlushing = false;

    if (successCount > 0) {
      const pendingCount = await localDB.getSyncQueueCount();
      const msg = pendingCount > 0
        ? `☁️ Synced ${successCount} items. ${pendingCount} pending.`
        : `☁️ All ${successCount} offline changes synced!`;
      if (Capacitor.isNativePlatform()) {
        await Toast.show({ text: msg, duration: 'short' });
      }
      console.log('[OfflineSync]', msg);
    }
  }

  // ── Execute Single Op Against Supabase ────────────────────────────────────────

  private async _executeOp(op: SyncOperation): Promise<void> {
    const { type, payload } = op;
    // Strip frontend-only metadata properties like _device_id before passing to Supabase queries
    const { _device_id, ...dbPayload } = payload;

    switch (type) {
      case 'save_user': {
        // Try full schema first, fall back to minimal
        const { error: fullErr } = await supabase
          .from('users')
          .upsert(dbPayload, { onConflict: 'id' });
        if (!fullErr) {
          // Also update settings separately (separate column)
          if (dbPayload.settings) {
            await supabase.from('users').update({ settings: dbPayload.settings }).eq('id', dbPayload.id);
          }
          return;
        }
        // Fallback minimal save
        const minPayload = {
          id: dbPayload.id, name: dbPayload.name, email: dbPayload.email,
          avatar: dbPayload.avatar, branch: dbPayload.branch, year: dbPayload.year,
          dream: dbPayload.dream, current_stage_index: dbPayload.current_stage_index,
          onboarding_complete: dbPayload.onboarding_complete, xp: dbPayload.xp,
          streak: dbPayload.streak, last_sync: dbPayload.last_sync,
        };
        const { error: minErr } = await supabase.from('users').upsert(minPayload, { onConflict: 'id' });
        if (minErr) throw minErr;
        break;
      }

      case 'save_task': {
        const { error } = await supabase.from('tasks').upsert(dbPayload, { onConflict: 'id' });
        if (error) throw error;
        break;
      }

      case 'delete_task': {
        const { error } = await supabase.from('tasks').delete().eq('id', dbPayload.id);
        if (error) throw error;
        break;
      }

      case 'save_stage': {
        const { error } = await supabase.from('completed_stages').insert(dbPayload);
        if (error && error.code !== '23505') throw error; // ignore duplicates
        break;
      }

      case 'clear_stages': {
        const { error } = await supabase.from('completed_stages').delete().eq('user_id', dbPayload.user_id);
        if (error) throw error;
        break;
      }

      case 'delete_stage': {
        const { error } = await supabase.from('completed_stages')
          .delete()
          .eq('user_id', dbPayload.user_id)
          .eq('stage_id', dbPayload.stage_id);
        if (error) throw error;
        break;
      }

      case 'save_roadmap': {
        const { error } = await supabase.from('roadmaps').upsert(dbPayload, { onConflict: 'user_id' });
        if (error) throw error;
        break;
      }

      case 'save_mentor_msg': {
        const { error } = await supabase.from('mentor_messages').insert(dbPayload);
        if (error && error.code !== '23505') throw error; // ignore duplicates
        break;
      }

      case 'clear_mentor': {
        const { error } = await supabase.from('mentor_messages').delete().eq('user_id', dbPayload.user_id);
        if (error) throw error;
        break;
      }

      case 'delete_mentor_session': {
        const { error } = await supabase.from('mentor_messages')
          .delete()
          .eq('user_id', dbPayload.user_id)
          .eq('session_id', dbPayload.session_id);
        if (error) throw error;
        break;
      }

      case 'save_reward': {
        const { error } = await supabase.from('users')
          .update({ rewards: dbPayload.rewards })
          .eq('id', dbPayload.user_id);
        if (error) throw error;
        break;
      }

      case 'save_flashcard': {
        const { error } = await supabase.from('flashcards').upsert(dbPayload, { onConflict: 'id' });
        if (error) throw error;
        break;
      }

      case 'save_flashcard_stats': {
        const { error } = await supabase.from('flashcard_stats').upsert(dbPayload, { onConflict: 'id' });
        if (error) throw error;
        break;
      }

      case 'delete_flashcard': {
        const { error } = await supabase.from('flashcards').update({ active: false, updated_at: new Date().toISOString() }).eq('id', dbPayload.id);
        if (error) throw error;
        break;
      }

      default:
        console.warn('[OfflineSync] Unknown operation type:', (op as any).type);
    }
  }

  // ── Network Listener ─────────────────────────────────────────────────────────

  private _startNetworkListener(): void {
    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', async (status) => {
        if (status.connected) {
          const pending = await localDB.getSyncQueueCount();
          if (pending > 0) {
            console.log('[OfflineSync] Network restored — auto-flushing queue...');
            await new Promise(r => setTimeout(r, 1500)); // let connection stabilize
            await this.flush();
          }
        }
      });
    } else {
      window.addEventListener('online', async () => {
        const pending = await localDB.getSyncQueueCount();
        if (pending > 0) {
          console.log('[OfflineSync] Browser online — auto-flushing queue...');
          await new Promise(r => setTimeout(r, 1000));
          await this.flush();
        }
      });
    }
  }

  // ── Legacy Migration ─────────────────────────────────────────────────────────

  private async _migrateLegacyQueue(): Promise<void> {
    try {
      const legacyRaw = localStorage.getItem('ks_offline_sync_queue');
      if (!legacyRaw) return;
      const legacyOps = JSON.parse(legacyRaw);
      if (Array.isArray(legacyOps) && legacyOps.length > 0) {
        await localDB.putMany('sync_queue', legacyOps);
        localStorage.removeItem('ks_offline_sync_queue');
        console.log(`[OfflineSync] Migrated ${legacyOps.length} legacy ops from localStorage`);
      }
    } catch (e) {
      // Non-fatal
    }
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────
export const offlineSyncService = new OfflineSyncService();
