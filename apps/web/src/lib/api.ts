import {
  cacheResponse,
  queueMutation,
  readCachedResponse,
} from "../offline/database";

export const apiBaseUrl =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000/api/v1";

const mutationMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function parseBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function canQueue(path: string) {
  return (
    !path.startsWith("/auth/") &&
    !path.startsWith("/calculations/") &&
    !path.startsWith("/organization/invitations") &&
    !path.includes("reset-password")
  );
}

const inFlightMutations = new Map<string, Promise<unknown>>();

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("avin_token");
  const activeBranchId = localStorage.getItem("avin_active_branch");
  const method = (options.method ?? "GET").toUpperCase();
  const isMutation = mutationMethods.has(method);
  const mutationId = isMutation ? crypto.randomUUID() : undefined;
  
  // Deduplicate identical concurrent mutations (prevents double-click bugs)
  let deduplicationKey: string | null = null;
  if (isMutation) {
    const bodyStr = typeof options.body === 'string' ? options.body : '';
    deduplicationKey = `${token}:${activeBranchId}:${method}:${path}:${bodyStr}`;
    if (inFlightMutations.has(deduplicationKey)) {
      return inFlightMutations.get(deduplicationKey) as Promise<T>;
    }
  }

  const queueCurrentMutation = async () => {
    await queueMutation({
      id: mutationId,
      path,
      method: method as "POST" | "PATCH" | "PUT" | "DELETE",
      body: parseBody(options.body),
    });
    return undefined as T;
  };

  if (!navigator.onLine) {
    if (isMutation && canQueue(path)) return queueCurrentMutation();
    if (!isMutation) {
      const cached = await readCachedResponse<T>(path);
      if (cached !== undefined) return cached;
    }
    throw new Error(
      isMutation
        ? "This action requires an internet connection"
        : "This information is not available offline yet",
    );
  }

  const performRequest = async (): Promise<T> => {
    try {
      const requestOptions: RequestInit = {
        ...options,
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeBranchId ? { "x-active-branch": activeBranchId } : {}),
          ...(mutationId ? { "Idempotency-Key": mutationId } : {}),
          ...options.headers,
        },
      };
    let response = await fetch(`${apiBaseUrl}${path}`, requestOptions);
    if (response.status === 401 && !path.startsWith("/auth/")) {
      const refresh = await fetch(`${apiBaseUrl}/auth/refresh`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (refresh.ok) {
        const refreshed = await refresh.json() as { data?: { token?: string } };
        if (refreshed.data?.token) {
          localStorage.setItem("avin_token", refreshed.data.token);
          const headers = new Headers(requestOptions.headers);
          headers.set("Authorization", `Bearer ${refreshed.data.token}`);
          response = await fetch(`${apiBaseUrl}${path}`, { ...requestOptions, headers });
        }
      }
    }
    if (response.status === 204) return undefined as T;
    const body = (await response.json().catch(() => {
      throw new Error(`The server returned an unreadable response (${response.status}). Please try again shortly.`);
    })) as {
      data?: T;
      error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
    };
    if (!response.ok) {
      const fields = Object.entries(body.error?.details?.fieldErrors ?? {})
        .map(([field, messages]) => `${field}: ${messages.join(", ")}`).join("; ");
      throw new Error(fields || body.error?.message || "Request failed");
    }
    // Browser storage failures must not hide a successful server response.
    if (!isMutation) await cacheResponse(path, body.data).catch(() => undefined);
    return body.data as T;
  } catch (error) {
    if (error instanceof TypeError) {
      if (isMutation && canQueue(path)) return queueCurrentMutation();
      if (!isMutation) {
        const cached = await readCachedResponse<T>(path);
        if (cached !== undefined) return cached;
      }
    }
    throw error;
  };
  };

  if (deduplicationKey) {
    const promise = performRequest();
    inFlightMutations.set(deduplicationKey, promise);
    try {
      return await promise;
    } finally {
      inFlightMutations.delete(deduplicationKey);
    }
  }

  return performRequest();
}
