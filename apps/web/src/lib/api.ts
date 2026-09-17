const baseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000/api/v1';

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('avin_token');
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as T;
}
