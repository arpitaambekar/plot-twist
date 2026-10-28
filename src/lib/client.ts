"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public integration?: string,
  ) {
    super(message);
  }
}

/** Browser-side JSON fetch with consistent error handling (see lib/api.ts for the server shape). */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const body = text ? safeParse(text) : null;
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; code?: string; integration?: string };
    const msg =
      res.status === 403 ? (b.error ?? "You don't have permission to do that.") : res.status === 401 ? "Your session has ended. Please sign in again." : (b.error ?? `Request failed (${res.status})`);
    throw new ApiError(msg, res.status, b.code, b.integration);
  }
  return body as T;
}

function safeParse(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return { error: t.slice(0, 200) };
  }
}

/** Trigger a browser download from an API route that returns a file. */
export async function download(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? "plot-twist-export.docx";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = decodeURIComponent(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
