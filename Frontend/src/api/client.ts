import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

const TOKEN_KEY = "ams_token";

let inMemoryToken: string | null = localStorage.getItem(TOKEN_KEY);
let unauthorizedHandler: (() => void) | null = null;

export function getStoredToken(): string | null {
  return inMemoryToken;
}

export function setStoredToken(token: string | null): void {
  inMemoryToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    unauthorizedHandler = null;
  };
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (inMemoryToken) {
      request.headers.set("Authorization", `Bearer ${inMemoryToken}`);
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      setStoredToken(null);
      try {
        sessionStorage.setItem(
          "ams_login_message",
          "Your session has expired. Please sign in again."
        );
      } catch {
        // Ignore if storage is inaccessible
      }
      if (unauthorizedHandler) {
        unauthorizedHandler();
      } else if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return response;
  },
};

const baseUrl = "/api";

export const api = createClient<paths>({
  baseUrl,
});

api.use(authMiddleware);

