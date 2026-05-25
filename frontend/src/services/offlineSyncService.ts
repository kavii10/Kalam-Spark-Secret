/**
 * OfflineSyncService — Kalam Spark
 *
 * Queues all data writes that happen while offline and automatically
 * flushes them to Supabase the moment internet is restored.
 *
 * Supported operations:
 *   - save_user        : UserProfile upsert
 *   - save_task        : DailyTask upsert
 *   - delete_task      : DailyTask delete by ID
 *   - save_stage       : Completed stage insert
 *   - save_roadmap     : Roadmap data upsert
 *   - save_mentor_msg  : Mentor chat message insert
 */

import { supabase } from './supabaseClient';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

// ── Types ──────────────────────────────────────────────────────────────────────
export type SyncOpType =
  | 'save_user'
  | 'save_task'
  | 'delete_task'
  | 'save_stage'
  | 'save_roadmap'
  | 'save_mentor_msg';

export interface SyncOperation {
  id: string;               // unique op ID
  type: SyncOpType;
  payload: any;             // data to sync
  createdAt: string;        // ISO timestamp when queued
  retries: number;          // how many times we tried
}

// ── Storage ───────────────────────────────────────────────────────────────────
const QUEUE_KEY = 'ks_offline_sync_queue';
const MAX_RETRIES = 5;

function loadQueue(): SyncOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncOperation[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Core Service ──────────────────────────────────────────────────────────────
class OfflineSyncService {
  private isFlushing = false;
  private listeners: Array<(count: number) => void> = [];

  constructor() {
    this._startNetworkListener();
  }

  /** Subscribe to queue size changes (for UI badge) */
  onQueueChange(cb: (count: number) => void): () => void {
    this.listeners.push(cb);
    cb(this.getPendingCount()); // emit current count immediately
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private _emit() {
    const count = this.getPendingCount();
    this.listeners.forEach(cb => cb(count));
  }

  /** Number of operations waiting to be synced */
  getPendingCount(): number {
    return loadQueue().length;
  }

  /**
   * Enqueue a sync operation.
   * Call this instead of calling Supabase directly when offline.
   */
  enqueue(type: SyncOpType, payload: any): void {
    const queue = loadQueue();
    // Deduplicate: for user saves and roadmap saves, replace existing op
    // so we don't accumulate stale profile snapshots
    const dedupeTypes: SyncOpType[] = ['save_user', 'save_roadmap'];
    const dedupeKey = type === 'save_task' ? payload?.id :
                      type === 'save_stage' ? `${payload?.user_id}__${payload?.stage_id}` :
                      null;

    let newQueue = queue;
    if (dedupeTypes.includes(type)) {
      newQueue = queue.filter(op => op.type !== type);
    } else if (dedupeKey) {
      newQueue = queue.filter(op => !(op.type === type && this._dedupKey(op) === dedupeKey));
    }

    const op: SyncOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    };

    newQueue.push(op);
    saveQueue(newQueue);
    this._emit();
    console.log(`[OfflineSync] Queued "${type}" — queue size: ${newQueue.length}`);
  }

  private _dedupKey(op: SyncOperation): string | null {
    if (op.type === 'save_task') return op.payload?.id ?? null;
    if (op.type === 'save_stage') return `${op.payload?.user_id}__${op.payload?.stage_id}`;
    return null;
  }

  /** Flush all queued operations to Supabase */
  async flush(): Promise<void> {
    if (this.isFlushing) return;
    const queue = loadQueue();
    if (queue.length === 0) return;

    this.isFlushing = true;
    console.log(`[OfflineSync] Flushing ${queue.length} pending operations...`);

    let successCount = 0;
    let failCount = 0;
    const remaining: SyncOperation[] = [];

    for (const op of queue) {
      try {
        await this._executeOp(op);
        successCount++;
        console.log(`[OfflineSync] ✅ "${op.type}" synced`);
      } catch (err: any) {
        op.retries++;
        if (op.retries < MAX_RETRIES) {
          remaining.push(op);
          failCount++;
          console.warn(`[OfflineSync] ⚠️ "${op.type}" failed (attempt ${op.retries}):`, err?.message);
        } else {
          console.error(`[OfflineSync] ❌ "${op.type}" dropped after ${MAX_RETRIES} retries`);
        }
      }
    }

    saveQueue(remaining);
    this._emit();
    this.isFlushing = false;

    if (successCount > 0) {
      const msg = remaining.length > 0
        ? `☁️ Synced ${successCount} items. ${remaining.length} pending.`
        : `☁️ All ${successCount} offline changes synced to cloud!`;
      if (Capacitor.isNativePlatform()) {
        await Toast.show({ text: msg, duration: 'short' });
      }
      console.log('[OfflineSync]', msg);
    }
  }

  /** Execute a single operation against Supabase */
  private async _executeOp(op: SyncOperation): Promise<void> {
    switch (op.type) {
      case 'save_user': {
        const { error } = await supabase
          .from('users')
          .upsert(op.payload, { onConflict: 'id' });
        if (error) throw error;
        break;
      }
      case 'save_task': {
        const { error } = await supabase
          .from('tasks')
          .upsert(op.payload, { onConflict: 'id' });
        if (error) throw error;
        break;
      }
      case 'delete_task': {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', op.payload.id);
        if (error) throw error;
        break;
      }
      case 'save_stage': {
        const { error } = await supabase
          .from('completed_stages')
          .insert(op.payload);
        // Ignore duplicate key errors (stage already saved)
        if (error && error.code !== '23505') throw error;
        break;
      }
      case 'save_roadmap': {
        const { error } = await supabase
          .from('roadmaps')
          .upsert(op.payload, { onConflict: 'user_id' });
        if (error) throw error;
        break;
      }
      case 'save_mentor_msg': {
        const { error } = await supabase
          .from('mentor_messages')
          .insert(op.payload);
        // Ignore unique constraint violations (message already saved)
        if (error && error.code !== '23505') throw error;
        break;
      }
      default:
        console.warn('[OfflineSync] Unknown operation type:', (op as any).type);
    }
  }

  /** Listen for network restoration and auto-flush */
  private _startNetworkListener(): void {
    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', async (status) => {
        if (status.connected && this.getPendingCount() > 0) {
          console.log('[OfflineSync] Network restored — auto-flushing queue...');
          // Small delay to let the connection stabilize
          await new Promise(r => setTimeout(r, 1500));
          await this.flush();
        }
      });
    } else {
      window.addEventListener('online', async () => {
        if (this.getPendingCount() > 0) {
          console.log('[OfflineSync] Browser online — auto-flushing queue...');
          await new Promise(r => setTimeout(r, 1000));
          await this.flush();
        }
      });
    }
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────
export const offlineSyncService = new OfflineSyncService();
