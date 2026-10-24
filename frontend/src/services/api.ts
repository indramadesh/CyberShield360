import type { ApiEnvelope } from "@/types";

const BASE = "/api/v1";

export class ApiClientError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("cs360-access");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  // No Content-Type header: the browser sets the multipart boundary itself.
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeader() },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || body.success === false) {
    const err = body.error ?? { code: "HTTP_ERROR", message: `Request failed (${res.status})` };
    throw new ApiClientError(err.code, err.message);
  }
  return body.data as T;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || body.success === false) {
    const err = body.error ?? { code: "HTTP_ERROR", message: `Request failed (${res.status})` };
    throw new ApiClientError(err.code, err.message);
  }
  return body.data as T;
}
