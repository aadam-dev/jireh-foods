/**
 * Offline Order Queue — IndexedDB backed
 *
 * When the POS can't reach the server (no internet / server hiccup),
 * orders are saved here instead of being lost.  On reconnect, the POS
 * calls syncPendingOrders() which replays each queued order.
 *
 * Works on ALL browsers including Safari (no Background Sync API needed).
 */

const DB_NAME = 'jireh-pos-offline';
const STORE   = 'pending-orders';
const DB_VER  = 1;

export interface PendingOrder {
  id: string;           // local UUID, not server order id
  payload: unknown;     // the same JSON body that goes to /api/pos/orders
  queuedAt: number;     // Date.now()
  attempts: number;     // retry count
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function enqueueOrder(payload: unknown): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: PendingOrder = { id, payload, queuedAt: Date.now(), attempts: 0 };
  await tx(db, 'readwrite', s => s.put(item));
  db.close();
  return id;
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t   = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as PendingOrder[]); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function removeOrder(id: string): Promise<void> {
  const db = await openDB();
  await tx(db, 'readwrite', s => s.delete(id));
  db.close();
}

export async function incrementAttempts(id: string): Promise<void> {
  const db = await openDB();
  const pending = await new Promise<PendingOrder | undefined>((res, rej) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result as PendingOrder | undefined);
    req.onerror   = () => rej(req.error);
  });
  if (pending) {
    await tx(db, 'readwrite', s => s.put({ ...pending, attempts: pending.attempts + 1 }));
  }
  db.close();
}

// ── Sync engine ───────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
}

/**
 * Attempt to submit all queued offline orders.
 * Returns a summary of how many succeeded / failed.
 * Call this on window 'online' event and on POS mount (if queue non-empty).
 */
export async function syncPendingOrders(
  onProgress?: (order: PendingOrder, success: boolean) => void,
): Promise<SyncResult> {
  const orders = await getPendingOrders();
  if (orders.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

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
      } else {
        // Server rejected the order (e.g. shift closed) — don't retry endlessly
        await incrementAttempts(order.id);
        failed++;
        onProgress?.(order, false);
      }
    } catch {
      // Still offline — leave in queue, try again later
      await incrementAttempts(order.id);
      failed++;
      onProgress?.(order, false);
    }
  }

  return { synced, failed };
}
