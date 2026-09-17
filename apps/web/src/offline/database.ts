import Dexie, { type EntityTable } from 'dexie';

export type PendingMutation = {
  id: string;
  path: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type OfflineDraft = {
  id: string;
  type: 'measurement' | 'quotation' | 'site-note';
  projectId?: string;
  data: unknown;
  updatedAt: number;
  syncState: 'local' | 'queued' | 'synced' | 'conflict';
};

class AvinOfflineDatabase extends Dexie {
  pendingMutations!: EntityTable<PendingMutation, 'id'>;
  drafts!: EntityTable<OfflineDraft, 'id'>;
  constructor() {
    super('avin-business-suite');
    this.version(1).stores({ pendingMutations: 'id, createdAt, attempts', drafts: 'id, type, projectId, updatedAt, syncState' });
  }
}

export const offlineDb = new AvinOfflineDatabase();

export async function queueMutation(input: Omit<PendingMutation, 'id' | 'createdAt' | 'attempts'>) {
  const mutation: PendingMutation = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0 };
  await offlineDb.pendingMutations.add(mutation);
  return mutation;
}

export async function syncPendingMutations(apiBase: string, token: string) {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  const pending = await offlineDb.pendingMutations.orderBy('createdAt').toArray();
  let synced = 0; let failed = 0;
  for (const mutation of pending) {
    try {
      const response = await fetch(`${apiBase}${mutation.path}`, { method: mutation.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': mutation.id }, body: mutation.body === undefined ? undefined : JSON.stringify(mutation.body) });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      await offlineDb.pendingMutations.delete(mutation.id); synced += 1;
    } catch (error) {
      failed += 1;
      await offlineDb.pendingMutations.update(mutation.id, { attempts: mutation.attempts + 1, lastError: error instanceof Error ? error.message : 'Sync failed' });
    }
  }
  return { synced, failed };
}
