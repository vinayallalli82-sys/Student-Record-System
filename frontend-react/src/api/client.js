const API_PREFIX = "/api";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

let unauthorizedHandler = () => {};
let csrfToken;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (
    contentType.includes("text/html")
    || /^\s*(<!doctype html|<html\b)/i.test(text)
  ) {
    return {
      message: "The server returned an HTML error page instead of JSON. Check the backend logs for details.",
    };
  }
  return text ? { message: text } : null;
}

async function fetchCsrfToken() {
  const response = await fetch(`${API_PREFIX}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await parseResponse(response);

  if (!response.ok || !payload?.csrf_token) {
    throw new ApiError(
      payload?.error || payload?.message || "Unable to initialize secure requests.",
      response.status,
      payload,
    );
  }

  csrfToken = payload.csrf_token;
  return csrfToken;
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (MUTATING_METHODS.has(method)) {
    headers.set("X-CSRFToken", await fetchCsrfToken());
  }

  const response = await fetch(
    path.startsWith("/") ? path : `${API_PREFIX}/${path}`,
    {
      ...options,
      method,
      headers,
      credentials: "include",
    },
  );
  const payload = await parseResponse(response);

  if (response.status === 401 && !path.includes("/auth/login")) {
    unauthorizedHandler();
  }

  if (!response.ok) {
    if (response.status === 400 && payload?.error === "CSRF validation failed.") {
      csrfToken = undefined;
    }

    throw new ApiError(
      payload?.error || payload?.message || `Request failed (${response.status}).`,
      response.status,
      payload,
    );
  }

  return payload;
}

export async function apiDownload(path) {
  const response = await fetch(path.startsWith("/") ? path : `${API_PREFIX}/${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/pdf, application/json" },
  });

  if (response.status === 401) unauthorizedHandler();

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new ApiError(
      payload?.error || payload?.message || `Request failed (${response.status}).`,
      response.status,
      payload,
    );
  }

  if (!(response.headers.get("content-type") || "").includes("application/pdf")) {
    throw new ApiError("The academic report endpoint did not return a PDF.", response.status);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "academic-report.pdf";
  return { blob: await response.blob(), filename };
}

export const authApi = {
  csrf: () => fetchCsrfToken(),
  login: (email, password) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  currentUser: () => apiRequest("/api/auth/me"),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),
};
