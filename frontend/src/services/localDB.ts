/**
 * KalamSparkDB — IndexedDB Local-First Database
 *
 * Creates a dedicated IndexedDB database named "KalamSparkDB" that stores
 * ALL app data locally so the app works like WhatsApp — always shows data,
 * always writable, syncs to Supabase in the background.
 *
 * Object Stores:
 *   user_profile      — User profile row (keyed by user id)
 *   roadmaps          — Career roadmaps (keyed by user_id)
 *   tasks             — Daily tasks (keyed by task id)
 *   mentor_messages   — Chat messages (keyed by message id)
 *   completed_stages  — Stage completion records (keyed by userId__stageId)
 *   sync_queue        — Pending Supabase operations (keyed by op id)
 */

const DB_NAME = 'KalamSparkDB';
const DB_VERSION = 1;

export type LocalStoreName =
  | 'user_profile'
  | 'roadmaps'
  | 'tasks'
  | 'mentor_messages'
  | 'completed_stages'
  | 'sync_queue';

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

        // user_profile: one record per user (keyed by user id)
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'id' });
        }

        // roadmaps: one per user
        if (!db.objectStoreNames.contains('roadmaps')) {
          db.createObjectStore('roadmaps', { keyPath: 'user_id' });
        }

        // tasks: many per user, indexed by user_id and date
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('user_id', 'user_id', { unique: false });
          taskStore.createIndex('date', 'date', { unique: false });
        }

        // mentor_messages: many per user, indexed by user_id and session_id
        if (!db.objectStoreNames.contains('mentor_messages')) {
          const msgStore = db.createObjectStore('mentor_messages', { keyPath: 'id' });
          msgStore.createIndex('user_id', 'user_id', { unique: false });
          msgStore.createIndex('session_id', 'session_id', { unique: false });
          msgStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // completed_stages: keyed by "userId__stageId" composite
        if (!db.objectStoreNames.contains('completed_stages')) {
          const stageStore = db.createObjectStore('completed_stages', { keyPath: 'key' });
          stageStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // sync_queue: pending operations waiting to be sent to Supabase
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        console.log('[LocalDB] Database created/upgraded to version', DB_VERSION);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('[LocalDB] Database opened:', DB_NAME);
        resolve(this.db);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        console.error('[LocalDB] Failed to open database:', error);
        reject(error);
      };

      request.onblocked = () => {
        console.warn('[LocalDB] Database upgrade blocked — close other tabs');
      };
    });

    return this.initPromise;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.init();
  }

  // ── CRUD Operations ─────────────────────────────────────────────────────────

  /** Get a single record by its primary key */
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

  /** Upsert a record (insert or replace) */
  async put(store: LocalStoreName, value: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[LocalDB] put error:', e);
    }
  }

  /** Delete a single record by primary key */
  async delete(store: LocalStoreName, key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[LocalDB] delete error:', e);
    }
  }

  /** Get all records from a store, optionally filtered by an index value */
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

  /** Delete all records in a store that match an index value */
  async deleteByIndex(
    store: LocalStoreName,
    indexName: string,
    indexKey: string
  ): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const index = tx.objectStore(store).index(indexName);
        const cursorReq = index.openCursor(IDBKeyRange.only(indexKey));
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
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
        const req = tx.objectStore(store).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[LocalDB] clearStore error:', e);
    }
  }

  // ── Batch Operations ────────────────────────────────────────────────────────

  /** Put multiple records into a store in one transaction */
  async putMany(store: LocalStoreName, values: any[]): Promise<void> {
    if (!values.length) return;
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const objStore = tx.objectStore(store);
        values.forEach(v => objStore.put(v));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[LocalDB] putMany error:', e);
    }
  }

  // ── User Data Management ────────────────────────────────────────────────────

  /** Wipe all data for a specific user across all stores */
  async clearUserData(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.delete('user_profile', userId),
        this.delete('roadmaps', userId),
        this.deleteByIndex('tasks', 'user_id', userId),
        this.deleteByIndex('mentor_messages', 'user_id', userId),
        this.deleteByIndex('completed_stages', 'user_id', userId),
      ]);
      console.log('[LocalDB] Cleared all local data for user:', userId);
    } catch (e) {
      console.warn('[LocalDB] clearUserData error:', e);
    }
  }

  /** Close and delete the entire database (full wipe on logout) */
  async deleteDatabase(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      this.initPromise = null;
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => {
          console.log('[LocalDB] Database deleted');
          resolve();
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => {
          // Still resolve — the delete will happen once connections close
          console.warn('[LocalDB] Database delete blocked, will complete on next open');
          resolve();
        };
      });
    } catch (e) {
      console.warn('[LocalDB] deleteDatabase error:', e);
    }
  }

  // ── Sync Queue Helpers ──────────────────────────────────────────────────────

  /** Add an operation to the sync queue */
  async enqueueSync(op: any): Promise<void> {
    await this.put('sync_queue', op);
  }

  /** Get all pending sync operations sorted by creation time */
  async getSyncQueue(): Promise<any[]> {
    const all = await this.getAll('sync_queue');
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Remove a completed sync operation from the queue */
  async dequeueSyncOp(opId: string): Promise<void> {
    await this.delete('sync_queue', opId);
  }

  /** Get total pending sync count */
  async getSyncQueueCount(): Promise<number> {
    const queue = await this.getSyncQueue();
    return queue.length;
  }

  // ── Migration Helpers ───────────────────────────────────────────────────────

  /**
   * Migrate legacy data from localStorage to IndexedDB.
   * Called once on first launch of the new version.
   */
  async migrateFromLocalStorage(): Promise<void> {
    try {
      // Migrate cached profile to user_profile store
      const cachedProfileRaw = localStorage.getItem('kalamspark_cached_profile');
      if (cachedProfileRaw) {
        const profile = JSON.parse(cachedProfileRaw);
        if (profile?.id) {
          const existing = await this.get('user_profile', profile.id);
          if (!existing) {
            await this.put('user_profile', { ...profile, _migratedFromLS: true });
            console.log('[LocalDB] Migrated user profile from localStorage');
          }
        }
      }

      // Migrate legacy offline sync queue from localStorage
      const legacyQueueRaw = localStorage.getItem('ks_offline_sync_queue');
      if (legacyQueueRaw) {
        const legacyOps = JSON.parse(legacyQueueRaw);
        if (Array.isArray(legacyOps) && legacyOps.length > 0) {
          await this.putMany('sync_queue', legacyOps);
          localStorage.removeItem('ks_offline_sync_queue');
          console.log(`[LocalDB] Migrated ${legacyOps.length} sync ops from localStorage`);
        }
      }
    } catch (e) {
      console.warn('[LocalDB] Migration error (non-fatal):', e);
    }
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────
export const localDB = new LocalDB();
