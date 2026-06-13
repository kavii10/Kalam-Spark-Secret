/**
 * KalamSparkDB — IndexedDB Local-First Database (v2)
 *
 * Improvements over v1:
 *  ✅ Schema versioning on every record
 *  ✅ Timestamps (createdAt, updatedAt, syncedAt) on every write
 *  ✅ Dirty flag (_isDirty) on locally-written records
 *  ✅ Compound index [user_id + date] on tasks for fast daily queries
 *  ✅ Storage quota monitoring with priority-based eviction
 *  ✅ Auto-expire tasks older than 30 days
 *  ✅ Mentor history local limit (200 messages, FIFO eviction)
 *  ✅ Transaction batching for all multi-record writes
 *  ✅ Emergency localStorage fallback snapshot
 *  ✅ Cached computed values (xp, streak, stage %)
 *  ✅ Device ID (stable per-install identifier)
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const DB_NAME = 'KalamSparkDB';
const DB_VERSION = 4;                    // bump when schema changes
const SCHEMA_VERSION = 2;               // stored on every record
const TASK_EXPIRY_DAYS = 30;            // auto-delete tasks older than this
const MAX_LOCAL_MENTOR_MSGS = 200;      // keep only the latest N messages locally
const STORAGE_WARN_PERCENT = 80;        // warn user if >80% quota used
const STORAGE_EVICT_PERCENT = 90;       // auto-evict if >90% quota used

export type LocalStoreName =
  | 'user_profile'
  | 'roadmaps'
  | 'tasks'
  | 'mentor_messages'
  | 'completed_stages'
  | 'sync_queue'
  | 'computed_cache'
  | 'flashcards'
  | 'flashcard_stats'
  | 'task_revisions';   // NEW: pre-computed dashboard values

// ─── Device ID — stable per-install identifier ───────────────────────────────
function getDeviceId(): string {
  let id = localStorage.getItem('ks_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('ks_device_id', id);
  }
  return id;
}
export const DEVICE_ID = getDeviceId();

// ─── Timestamp helpers ────────────────────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }

/** Wrap any record with standard metadata fields */
function withMeta<T extends object>(record: T, markDirty = true): T & {
  _schemaVersion: number;
  _updatedAt: string;
  _isDirty: boolean;
  _deviceId: string;
} {
  return {
    ...record,
    _schemaVersion: SCHEMA_VERSION,
    _updatedAt: nowISO(),
    _isDirty: markDirty,
    _deviceId: DEVICE_ID,
  };
}

/** Mark a record as synced (clears dirty flag, records sync time) */
function markSynced<T extends object>(record: T): T & { _isDirty: boolean; _syncedAt: string } {
  return { ...record, _isDirty: false, _syncedAt: nowISO() };
}

// ─── Simple LZ-style string compression (no external lib) ────────────────────
// Uses built-in btoa/atob for base64 encoding of JSON — reduces redundant keys
function compressJSON(data: any): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch {
    return JSON.stringify(data);
  }
}

function decompressJSON(raw: string): any {
  try {
    // Try decompressed first
    return JSON.parse(decodeURIComponent(atob(raw)));
  } catch {
    // Fallback: plain JSON (for records written before compression)
    return JSON.parse(raw);
  }
}

// ─── LocalDB Class ───────────────────────────────────────────────────────────

class LocalDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  // ── Open / Create Database ──────────────────────────────────────────────────
  init(): Promise<IDBDatabase> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // ── user_profile: one record per user ──
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'id' });
        }

        // ── roadmaps: one per user ──
        if (!db.objectStoreNames.contains('roadmaps')) {
          db.createObjectStore('roadmaps', { keyPath: 'user_id' });
        }

        // ── tasks: compound index [user_id + date] for fast daily queries ──
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('user_id', 'user_id', { unique: false });
          taskStore.createIndex('date', 'date', { unique: false });
          taskStore.createIndex('user_date', ['user_id', 'date'], { unique: false }); // compound
        } else if (oldVersion < 2) {
          // v1→v2 migration: add compound index to existing store
          // NOTE: can't modify existing stores in onupgradeneeded with a transaction
          // The compound index will be added fresh for new installs
        }

        // ── mentor_messages ──
        if (!db.objectStoreNames.contains('mentor_messages')) {
          const msgStore = db.createObjectStore('mentor_messages', { keyPath: 'id' });
          msgStore.createIndex('user_id', 'user_id', { unique: false });
          msgStore.createIndex('session_id', 'session_id', { unique: false });
          msgStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // ── completed_stages ──
        if (!db.objectStoreNames.contains('completed_stages')) {
          const stageStore = db.createObjectStore('completed_stages', { keyPath: 'key' });
          stageStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // ── sync_queue ──
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // ── computed_cache: pre-computed dashboard values (NEW in v2) ──
        if (!db.objectStoreNames.contains('computed_cache')) {
          db.createObjectStore('computed_cache', { keyPath: 'key' });
        }

        // ── flashcards (NEW in v3) ──
        if (!db.objectStoreNames.contains('flashcards')) {
          const cardStore = db.createObjectStore('flashcards', { keyPath: 'id' });
          cardStore.createIndex('user_id', 'user_id', { unique: false });
          cardStore.createIndex('deck_id', 'deck_id', { unique: false });
        }

        // ── flashcard_stats (NEW in v3) ──
        if (!db.objectStoreNames.contains('flashcard_stats')) {
          const statsStore = db.createObjectStore('flashcard_stats', { keyPath: 'id' });
          statsStore.createIndex('user_id', 'user_id', { unique: false });
          statsStore.createIndex('flashcard_id', 'flashcard_id', { unique: false });
        }

        // ── task_revisions (NEW in v4) ──
        if (!db.objectStoreNames.contains('task_revisions')) {
          const revStore = db.createObjectStore('task_revisions', { keyPath: 'id' });
          revStore.createIndex('user_id', 'user_id', { unique: false });
          revStore.createIndex('next_review', 'next_review', { unique: false });
        }

        console.log(`[LocalDB] Schema upgraded from v${oldVersion} → v${DB_VERSION}`);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('[LocalDB] Opened KalamSparkDB v' + DB_VERSION);

        // Handle version change from another tab
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
          this.initPromise = null;
          console.warn('[LocalDB] Database version changed — closed connection');
        };

        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onblocked = () => {
        console.warn('[LocalDB] Upgrade blocked — another tab has the DB open');
      };
    });

    return this.initPromise;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.init();
  }

  // ── CRUD Operations ─────────────────────────────────────────────────────────

  /** Get a single record by primary key */
  async get<T = any>(store: LocalStoreName, key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[LocalDB] get error:', e);
      return null;
    }
  }

  /** Upsert a record — auto-stamps metadata */
  async put(store: LocalStoreName, value: any, dirty = true): Promise<void> {
    try {
      const db = await this.getDB();
      const stamped = withMeta(value, dirty);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(stamped);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[LocalDB] put error:', e);
    }
  }

  /** Mark a record as synced (sets _isDirty=false, _syncedAt=now) */
  async markSynced(store: LocalStoreName, key: string): Promise<void> {
    try {
      const existing = await this.get(store, key);
      if (existing) {
        await this.put(store, markSynced(existing), false);
      }
    } catch (e) {
      console.warn('[LocalDB] markSynced error:', e);
    }
  }

  /** Delete a single record by primary key */
  async delete(store: LocalStoreName, key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[LocalDB] delete error:', e);
    }
  }

  /** Get all records from a store, optionally filtered by index */
  async getAll<T = any>(
    store: LocalStoreName,
    indexName?: string,
    indexKey?: string
  ): Promise<T[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const objStore = tx.objectStore(store);
        let req: IDBRequest;
        if (indexName && indexKey !== undefined) {
          req = objStore.index(indexName).getAll(IDBKeyRange.only(indexKey));
        } else {
          req = objStore.getAll();
        }
        req.onsuccess = () => resolve((req.result as T[]) ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[LocalDB] getAll error:', e);
      return [];
    }
  }

  /** Delete all records matching an index value */
  async deleteByIndex(store: LocalStoreName, indexName: string, indexKey: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const cursorReq = tx.objectStore(store).index(indexName).openCursor(IDBKeyRange.only(indexKey));
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) { cursor.delete(); cursor.continue(); }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[LocalDB] deleteByIndex error:', e);
    }
  }

  /** Clear all records in a store */
  async clearStore(store: LocalStoreName): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[LocalDB] clearStore error:', e);
    }
  }

  // ── Batch Operations (single transaction = atomic + fast) ───────────────────

  /** Put many records in ONE transaction */
  async putMany(store: LocalStoreName, values: any[], dirty = false): Promise<void> {
    if (!values.length) return;
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const objStore = tx.objectStore(store);
        values.forEach(v => objStore.put(withMeta(v, dirty)));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[LocalDB] putMany error:', e);
    }
  }

  // ── Conflict Resolution ─────────────────────────────────────────────────────

  /**
   * Two-way conflict resolution: compare local _updatedAt vs remote updatedAt.
   * Remote (Supabase) wins if it has a newer timestamp.
   * Returns the winning record and a flag indicating if remote won.
   */
  resolveConflict<T extends { _updatedAt?: string }>(
    local: T | null,
    remote: T & { updated_at?: string; updatedAt?: string }
  ): { winner: T; remoteWon: boolean } {
    if (!local) return { winner: remote, remoteWon: true };

    const localTime = new Date(local._updatedAt || 0).getTime();
    const remoteTime = new Date(remote.updated_at || remote.updatedAt || 0).getTime();

    if (remoteTime > localTime) {
      return { winner: remote, remoteWon: true };
    }
    return { winner: local, remoteWon: false };
  }

  // ── Computed Cache ──────────────────────────────────────────────────────────

  /** Store a pre-computed value (e.g. total XP, streak, stage %) */
  async setComputed(userId: string, key: string, value: any): Promise<void> {
    await this.put('computed_cache', {
      key: `${userId}__${key}`,
      user_id: userId,
      value,
      computedAt: nowISO(),
    }, false);
  }

  /** Retrieve a cached computed value */
  async getComputed(userId: string, key: string): Promise<any | null> {
    const record = await this.get('computed_cache', `${userId}__${key}`);
    return record ? (record as any).value : null;
  }

  /** Invalidate a computed cache entry */
  async invalidateComputed(userId: string, key: string): Promise<void> {
    await this.delete('computed_cache', `${userId}__${key}`);
  }

  // ── Storage Quota Management ────────────────────────────────────────────────

  /** Returns storage usage: { usedMB, quotaMB, usedPercent } */
  async getStorageUsage(): Promise<{ usedMB: number; quotaMB: number; usedPercent: number } | null> {
    try {
      if (!navigator.storage?.estimate) return null;
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const usedMB = Math.round(usage / 1024 / 1024 * 10) / 10;
      const quotaMB = Math.round(quota / 1024 / 1024 * 10) / 10;
      const usedPercent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      return { usedMB, quotaMB, usedPercent };
    } catch {
      return null;
    }
  }

  /**
   * Check storage quota before a large write.
   * Triggers priority-based eviction if >90% used.
   * Returns true if it's safe to write.
   */
  async checkAndEvict(userId: string): Promise<boolean> {
    const usage = await this.getStorageUsage();
    if (!usage) return true;

    if (usage.usedPercent >= STORAGE_EVICT_PERCENT) {
      console.warn(`[LocalDB] Storage ${usage.usedPercent}% full — evicting non-critical data`);
      await this._evictLowPriority(userId);
    }

    if (usage.usedPercent >= STORAGE_WARN_PERCENT) {
      console.warn(`[LocalDB] Storage ${usage.usedPercent}% used (${usage.usedMB}/${usage.quotaMB} MB)`);
    }

    // Re-check after eviction
    const after = await this.getStorageUsage();
    return !after || after.usedPercent < 95;
  }

  /**
   * Priority-based eviction (lowest priority first):
   * 1. computed_cache   — always safe to delete (recomputable)
   * 2. Old mentor msgs  — keep only last 100 instead of 200
   * 3. Old tasks        — reduce expiry from 30 days to 7 days
   * NEVER delete: user_profile, roadmaps, completed_stages, sync_queue
   */
  private async _evictLowPriority(userId: string): Promise<void> {
    // Level 1: clear computed cache
    await this.clearStore('computed_cache');
    console.log('[LocalDB] Evicted computed_cache');

    // Level 2: trim mentor history to 100 messages
    await this._trimMentorHistory(userId, 100);

    // Level 3: expire tasks older than 7 days
    await this._expireOldTasks(userId, 7);
  }

  // ── Maintenance Operations ──────────────────────────────────────────────────

  /**
   * Run all maintenance tasks. Call this after login or periodically.
   * - Expire tasks older than TASK_EXPIRY_DAYS
   * - Trim mentor history to MAX_LOCAL_MENTOR_MSGS
   * - Check storage quota
   */
  async runMaintenance(userId: string): Promise<void> {
    try {
      await Promise.all([
        this._expireOldTasks(userId, TASK_EXPIRY_DAYS),
        this._trimMentorHistory(userId, MAX_LOCAL_MENTOR_MSGS),
      ]);
      await this.checkAndEvict(userId);
      console.log('[LocalDB] Maintenance complete for user:', userId);
    } catch (e) {
      console.warn('[LocalDB] Maintenance error (non-fatal):', e);
    }
  }

  /** Delete tasks older than N days from IndexedDB (Supabase keeps them permanently) */
  private async _expireOldTasks(userId: string, daysOld: number): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const cutoffStr = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD

    const tasks = await this.getAll<any>('tasks', 'user_id', userId);
    const toDelete = tasks.filter(t => t.date && t.date < cutoffStr);

    if (toDelete.length === 0) return;

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      toDelete.forEach(t => store.delete(t.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[LocalDB] Expired ${toDelete.length} tasks older than ${daysOld} days`);
  }

  /** Keep only the latest N mentor messages in IndexedDB (FIFO eviction) */
  private async _trimMentorHistory(userId: string, maxCount: number): Promise<void> {
    const msgs = await this.getAll<any>('mentor_messages', 'user_id', userId);
    if (msgs.length <= maxCount) return;

    // Sort oldest first, delete the excess from the front
    msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const toDelete = msgs.slice(0, msgs.length - maxCount);

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('mentor_messages', 'readwrite');
      const store = tx.objectStore('mentor_messages');
      toDelete.forEach(m => store.delete(m.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[LocalDB] Trimmed ${toDelete.length} mentor messages (kept ${maxCount})`);
  }

  // ── Emergency Backup Snapshot ───────────────────────────────────────────────

  /**
   * Write a lightweight emergency snapshot to localStorage.
   * Contains just enough data to show the app if IndexedDB is corrupted.
   * NEVER stores sensitive keys — only profile, roadmap summary, today's tasks.
   */
  async writeEmergencySnapshot(userId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [profile, roadmap, tasks] = await Promise.all([
        this.get('user_profile', userId),
        this.get('roadmaps', userId),
        this.getAll<any>('tasks', 'user_id', userId),
      ]);

      const todayTasks = tasks.filter(t => t.date === today).slice(0, 20);

      const snapshot = {
        userId,
        snapshotAt: nowISO(),
        profile: profile ? {
          id: (profile as any).id,
          name: (profile as any).name,
          email: (profile as any).email,
          xp: (profile as any).xp,
          streak: (profile as any).streak,
          currentStageIndex: (profile as any).currentStageIndex,
          onboardingComplete: (profile as any).onboardingComplete,
          isAuthenticated: true,
          dream: (profile as any).dream,
          settings: (profile as any).settings,
          rewards: (profile as any).rewards,
        } : null,
        roadmapSummary: roadmap ? {
          dream: (roadmap as any).roadmap_data?.dream,
          stageCount: (roadmap as any).roadmap_data?.stages?.length ?? 0,
        } : null,
        todayTasks,
      };

      localStorage.setItem('ks_emergency_snapshot', JSON.stringify(snapshot));
    } catch (e) {
      // Non-fatal — emergency snapshot is best-effort
    }
  }

  /** Restore emergency snapshot from localStorage if IndexedDB is unavailable */
  getEmergencySnapshot(): { profile: any; todayTasks: any[] } | null {
    try {
      const raw = localStorage.getItem('ks_emergency_snapshot');
      if (!raw) return null;
      const snap = JSON.parse(raw);
      return { profile: snap.profile, todayTasks: snap.todayTasks || [] };
    } catch {
      return null;
    }
  }

  // ── User Data Management ────────────────────────────────────────────────────

  /** Wipe all data for one user across all stores */
  async clearUserData(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.delete('user_profile', userId),
        this.delete('roadmaps', userId),
        this.deleteByIndex('tasks', 'user_id', userId),
        this.deleteByIndex('mentor_messages', 'user_id', userId),
        this.deleteByIndex('completed_stages', 'user_id', userId),
        this.deleteByIndex('computed_cache', 'user_id', userId),
        this.deleteByIndex('flashcards', 'user_id', userId),
        this.deleteByIndex('flashcard_stats', 'user_id', userId),
      ]);
      localStorage.removeItem('ks_emergency_snapshot');
      console.log('[LocalDB] Cleared all local data for user:', userId);
    } catch (e) {
      console.warn('[LocalDB] clearUserData error:', e);
    }
  }

  /** Close and delete the entire database (full wipe on logout) */
  async deleteDatabase(): Promise<void> {
    try {
      if (this.db) { this.db.close(); this.db = null; }
      this.initPromise = null;
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => { console.log('[LocalDB] Database deleted'); resolve(); };
        req.onerror = () => reject(req.error);
        req.onblocked = () => { console.warn('[LocalDB] Delete blocked'); resolve(); };
      });
      localStorage.removeItem('ks_emergency_snapshot');
    } catch (e) {
      console.warn('[LocalDB] deleteDatabase error:', e);
    }
  }

  // ── Sync Queue Helpers ──────────────────────────────────────────────────────

  async enqueueSync(op: any): Promise<void> {
    await this.put('sync_queue', op, false);
  }

  async getSyncQueue(): Promise<any[]> {
    const all = await this.getAll('sync_queue');
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async dequeueSyncOp(opId: string): Promise<void> {
    await this.delete('sync_queue', opId);
  }

  async getSyncQueueCount(): Promise<number> {
    return (await this.getSyncQueue()).length;
  }

  // ── Migration Helpers ───────────────────────────────────────────────────────

  async migrateFromLocalStorage(): Promise<void> {
    try {
      const cachedRaw = localStorage.getItem('kalamspark_cached_profile');
      if (cachedRaw) {
        const profile = JSON.parse(cachedRaw);
        if (profile?.id) {
          const existing = await this.get('user_profile', profile.id);
          if (!existing) {
            await this.put('user_profile', { ...profile, _migratedFromLS: true });
            console.log('[LocalDB] Migrated user profile from localStorage');
          }
        }
      }

      const legacyQueueRaw = localStorage.getItem('ks_offline_sync_queue');
      if (legacyQueueRaw) {
        const ops = JSON.parse(legacyQueueRaw);
        if (Array.isArray(ops) && ops.length > 0) {
          await this.putMany('sync_queue', ops, false);
          localStorage.removeItem('ks_offline_sync_queue');
          console.log(`[LocalDB] Migrated ${ops.length} sync ops from localStorage`);
        }
      }
    } catch (e) {
      console.warn('[LocalDB] Migration error (non-fatal):', e);
    }
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────
export const localDB = new LocalDB();
export { withMeta, markSynced, nowISO, TASK_EXPIRY_DAYS, MAX_LOCAL_MENTOR_MSGS };
