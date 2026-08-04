/* Shared browser-side fetch for the back office and POS.
   ────────────────────────────────────────────────────────────────────────────
   Screens used to do `setData(await res.json())` with no status check. That is
   fine until a session expires: the request comes back 401 with a JSON error
   body, `res.json()` resolves happily, and the page sets `{ error: … }` as its
   list — which then throws on `.map`. The owner sees a blank screen or a
   crashed boundary instead of "please sign in".

   apiGet/apiSend centralise that: a 401 sends the user to /login with a
   callbackUrl, anything else non-2xx throws with the server's own message. */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const target = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?callbackUrl=${encodeURIComponent(target)}`);
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, 'Your session expired. Please sign in again.');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new ApiError(res.status, message);
  }

  // 204 and friends have no body.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return handle<T>(await fetch(url, { ...init, method: 'GET' }));
}

export async function apiSend<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

/** Narrow an unknown catch value to something safe to show a user. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
