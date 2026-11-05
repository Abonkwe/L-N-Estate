import { api, setStoredToken } from "./client";
import type { components } from "./schema";

export type User = components["schemas"]["UserOut"];
export type Token = components["schemas"]["Token"];

export async function loginApi(email: string, password: string): Promise<Token> {
  const result = await api.POST("/auth/login", {
    body: {
      username: email,
      password: password,
      scope: "",
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    bodySerializer: (body) => new URLSearchParams(body as Record<string, string>).toString(),
  });

  if (result.data) {
    setStoredToken(result.data.access_token);
    return result.data;
  }

  let message = "Invalid email or password";
  const err = result.error as { detail?: unknown };
  if (typeof err === "object" && err !== null && "detail" in err) {
    if (typeof err.detail === "string") {
      message = err.detail;
    } else if (Array.isArray(err.detail) && err.detail[0]?.msg) {
      message = err.detail[0].msg;
    }
  }
  throw new Error(message || `Login failed (${result.response.status})`);
}

export async function getMeApi(): Promise<User> {
  const result = await api.GET("/auth/me");
  if (result.data) {
    return result.data;
  }
  throw new Error(`Failed to load profile (${result.response.status})`);
}
