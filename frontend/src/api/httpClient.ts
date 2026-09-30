import { API_BASE_URL } from "./config";

/** Error thrown for every failed call to the backend. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached at all. */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isNetwork() {
    return this.status === 0;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** FastAPI answers `{ detail: "..." }`, or `{ detail: [{ msg, loc }] }` for validation errors. */
async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const d = data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((e) => `${(e.loc ?? []).slice(1).join(".")} : ${e.msg}`).join(" ; ");
  } catch {
    /* body was not JSON */
  }
  return `Erreur serveur (${res.status})`;
}

/** The single place where the frontend talks HTTP to the backend. */
export async function request<T>(path: string, { method = "GET", body, query, signal }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      signal,
      // FormData (file upload): the browser sets the multipart Content-Type + boundary itself.
      headers: body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, `Impossible de joindre le serveur (${API_BASE_URL}). Vérifiez que le backend est démarré.`);
  }
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  // DELETE endpoints answer 204 No Content — there is no JSON body to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Pages through a limit/skip endpoint until it is exhausted (backend caps `limit` at 1000). */
export async function fetchAllPages<T>(
  page: (skip: number, limit: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let skip = 0; ; skip += pageSize) {
    const chunk = await page(skip, pageSize);
    all.push(...chunk);
    if (chunk.length < pageSize) return all;
  }
}

/** Human-readable message for any thrown value (ApiError messages are already user-facing French). */
export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : "Erreur inattendue.");
