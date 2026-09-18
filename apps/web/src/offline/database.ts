import Dexie, { type EntityTable } from "dexie";

export type SyncState = "pending" | "syncing" | "failed" | "conflict";

export type PendingMutation = {
  id: string;
  path: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  createdAt: number;
  attempts: number;
  state: SyncState;
  lastAttemptAt?: number;
  lastError?: string;
};

export type OfflineDraft = {
  id: string;
  type: "measurement" | "quotation" | "site-note";
  projectId?: string;
  data: unknown;
  updatedAt: number;
  syncState: "local" | "queued" | "synced" | "conflict";
};

export type CachedResponse = {
  key: string;
  data: unknown;
  cachedAt: number;
};

class AvinOfflineDatabase extends Dexie {
  pendingMutations!: EntityTable<PendingMutation, "id">;
  drafts!: EntityTable<OfflineDraft, "id">;
  cachedResponses!: EntityTable<CachedResponse, "key">;

  constructor() {
    super("avin-business-suite");
    this.version(1).stores({
      pendingMutations: "id, createdAt, attempts",
      drafts: "id, type, projectId, updatedAt, syncState",
    });
    this.version(2)
      .stores({
        pendingMutations: "id, state, createdAt, attempts",
        drafts: "id, type, projectId, updatedAt, syncState",
        cachedResponses: "key, cachedAt",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("pendingMutations")
          .toCollection()
          .modify((mutation: PendingMutation) => {
            mutation.state = mutation.state ?? "pending";
          });
      });
  }
}

export const offlineDb = new AvinOfflineDatabase();

export function offlineCacheKey(path: string) {
  const user = localStorage.getItem("avin_user") ?? "anonymous";
  return `${user}:${path}`;
}

export async function cacheResponse(path: string, data: unknown) {
  await offlineDb.cachedResponses.put({
    key: offlineCacheKey(path),
    data,
    cachedAt: Date.now(),
  });
}

export async function readCachedResponse<T>(path: string) {
  const cached = await offlineDb.cachedResponses.get(offlineCacheKey(path));
  return cached?.data as T | undefined;
}

export function announceSyncChange() {
  window.dispatchEvent(new CustomEvent("avin:sync-change"));
}

export async function queueMutation(
  input: Omit<
    PendingMutation,
    "id" | "createdAt" | "attempts" | "state"
  > & { id?: string },
) {
  const mutation: PendingMutation = {
    path: input.path,
    method: input.method,
    body: input.body,
    id: input.id ?? crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
  };
  await offlineDb.pendingMutations.put(mutation);
  announceSyncChange();
  return mutation;
}

export async function retryMutation(id: string) {
  await offlineDb.pendingMutations.update(id, {
    state: "pending",
    lastError: undefined,
  });
  announceSyncChange();
}

export async function discardMutation(id: string) {
  await offlineDb.pendingMutations.delete(id);
  announceSyncChange();
}

let activeSync: Promise<{
  synced: number;
  failed: number;
  conflicts: number;
}> | null = null;

export function syncPendingMutations(apiBase: string, token: string) {
  if (activeSync) return activeSync;
  activeSync = runSync(apiBase, token).finally(() => {
    activeSync = null;
    announceSyncChange();
  });
  return activeSync;
}

async function runSync(apiBase: string, token: string) {
  if (!navigator.onLine) return { synced: 0, failed: 0, conflicts: 0 };
  const pending = await offlineDb.pendingMutations
    .where("state")
    .anyOf("pending", "failed")
    .sortBy("createdAt");
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const mutation of pending) {
    await offlineDb.pendingMutations.update(mutation.id, {
      state: "syncing",
      lastAttemptAt: Date.now(),
    });
    announceSyncChange();
    try {
      const response = await fetch(`${apiBase}${mutation.path}`, {
        method: mutation.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": mutation.id,
        },
        body:
          mutation.body === undefined
            ? undefined
            : JSON.stringify(mutation.body),
      });
      if (response.ok) {
        await offlineDb.pendingMutations.delete(mutation.id);
        synced += 1;
        continue;
      }
      const payload = (await response.json().catch(() => undefined)) as
        | { error?: { message?: string } }
        | undefined;
      const message =
        payload?.error?.message ?? `Server returned ${response.status}`;
      if ([400, 404, 409, 412, 422].includes(response.status)) {
        conflicts += 1;
        await offlineDb.pendingMutations.update(mutation.id, {
          state: "conflict",
          attempts: mutation.attempts + 1,
          lastError: message,
        });
      } else {
        failed += 1;
        await offlineDb.pendingMutations.update(mutation.id, {
          state: "failed",
          attempts: mutation.attempts + 1,
          lastError: message,
        });
      }
    } catch (error) {
      failed += 1;
      await offlineDb.pendingMutations.update(mutation.id, {
        state: "failed",
        attempts: mutation.attempts + 1,
        lastError: error instanceof Error ? error.message : "Sync failed",
      });
      if (!navigator.onLine) break;
    }
  }
  return { synced, failed, conflicts };
}
