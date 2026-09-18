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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("avin_token");
  const method = (options.method ?? "GET").toUpperCase();
  const isMutation = mutationMethods.has(method);
  const mutationId = isMutation ? crypto.randomUUID() : undefined;
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

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(mutationId ? { "Idempotency-Key": mutationId } : {}),
        ...options.headers,
      },
    });
    const body = (await response.json()) as {
      data?: T;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(body.error?.message ?? "Request failed");
    if (!isMutation) await cacheResponse(path, body.data);
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
  }
}
