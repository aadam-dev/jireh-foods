/**
 * Offline Order Queue — IndexedDB backed
 *
 * When the POS can't reach the server (no internet / server hiccup),
 * orders are saved here instead of being lost.  On reconnect, the POS
 * calls syncPendingOrders() which replays each queued order.
 */

const DB_NAME = 'jireh-pos-offline';
const STORE   = 'pending-orders';
const DB_VER  = 2;
const MAX_ATTEMPTS = 8;

export interface PendingOrder {
  id: string;
  payload: unknown;
  queuedAt: number;
  attempts: number;
  createdByUserId?: string;
  sessionId?: string;
  status?: 'pending' | 'failed';
  lastError?: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  authFailed: boolean;
  deadLettered: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function enqueueOrder(
  payload: unknown,
  meta?: { createdByUserId?: string; sessionId?: string },
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: PendingOrder = {
    id,
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    createdByUserId: meta?.createdByUserId,
    sessionId: meta?.sessionId,
    status: 'pending',
  };
  await tx(db, 'readwrite', s => s.put(item));
  db.close();
  return id;
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t   = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as PendingOrder[]).filter(o => o.status !== 'failed'));
    };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function getFailedOrders(): Promise<PendingOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t   = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as PendingOrder[]).filter(o => o.status === 'failed'));
    };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function removeOrder(id: string): Promise<void> {
  const db = await openDB();
  await tx(db, 'readwrite', s => s.delete(id));
  db.close();
}

async function updateOrder(id: string, patch: Partial<PendingOrder>): Promise<void> {
  const db = await openDB();
  const pending = await new Promise<PendingOrder | undefined>((res, rej) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result as PendingOrder | undefined);
    req.onerror   = () => rej(req.error);
  });
  if (pending) {
    await tx(db, 'readwrite', s => s.put({ ...pending, ...patch }));
  }
  db.close();
}

export async function incrementAttempts(id: string, lastError?: string): Promise<void> {
  const db = await openDB();
  const pending = await new Promise<PendingOrder | undefined>((res, rej) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result as PendingOrder | undefined);
    req.onerror   = () => rej(req.error);
  });
  if (pending) {
    const attempts = pending.attempts + 1;
    await tx(db, 'readwrite', s => s.put({
      ...pending,
      attempts,
      lastError,
      status: attempts >= MAX_ATTEMPTS ? 'failed' : pending.status ?? 'pending',
    }));
  }
  db.close();
}

export async function discardOrder(id: string): Promise<void> {
  await removeOrder(id);
}

function isPermanentFailure(status: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 409 || status === 422;
}

export async function syncPendingOrders(
  onProgress?: (order: PendingOrder, success: boolean) => void,
): Promise<SyncResult> {
  const orders = await getPendingOrders();
  if (orders.length === 0) return { synced: 0, failed: 0, authFailed: false, deadLettered: 0 };

  let synced = 0;
  let failed = 0;
  let authFailed = false;
  let deadLettered = 0;

  for (const order of orders) {
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order.payload),
      });

      if (res.ok) {
        await removeOrder(order.id);
        synced++;
        onProgress?.(order, true);
        continue;
      }

      const errBody = await res.json().catch(() => ({}));
      const message = errBody.error || res.statusText || `HTTP ${res.status}`;

      if (res.status === 401) {
        authFailed = true;
        failed++;
        onProgress?.(order, false);
        continue;
      }

      if (isPermanentFailure(res.status)) {
        await updateOrder(order.id, { status: 'failed', lastError: message });
        deadLettered++;
        failed++;
        onProgress?.(order, false);
        continue;
      }

      await incrementAttempts(order.id, message);
      failed++;
      onProgress?.(order, false);
    } catch {
      await incrementAttempts(order.id, 'Network error');
      failed++;
      onProgress?.(order, false);
    }
  }

  return { synced, failed, authFailed, deadLettered };
}
