

import { auth } from "../config/firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export interface ApiError {
  message: string;
  status: number;
}

export class StockPilotApiError extends Error implements ApiError {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StockPilotApiError";
    this.status = status;
  }
}

// Retained for backward compatibility with the existing JWT session.
export function getStoredToken(): string | null {
  return window.localStorage.getItem("stockpilot_token");
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem("stockpilot_token", token);
}

export function clearStoredSession(): void {
  window.localStorage.removeItem("stockpilot_token");
  window.localStorage.removeItem("stockpilot_user");
  window.localStorage.removeItem("stockpilot_workspace");
}

// Firebase ID token takes priority over the legacy JWT.
async function getAuthToken(): Promise<string | null> {
  const firebaseUser = auth.currentUser;

  if (firebaseUser) {
    try {
      return await firebaseUser.getIdToken();
    } catch {
      throw new StockPilotApiError(
        "Unable to refresh your Firebase authentication session.",
        401
      );
    }
  }

  return getStoredToken();
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!headers.has("Content-Type") && options.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new StockPilotApiError(
      "Unable to connect to the StockPilot server.",
      0
    );
  }

  const contentType = response.headers.get("content-type");

  const payload =
    contentType?.includes("application/json")
      ? await response.json()
      : null;

  if (!response.ok) {
    throw new StockPilotApiError(
      payload?.message || "The request could not be completed.",
      response.status
    );
  }

  return payload as T;
}

export async function downloadApiFile(
  path: string,
  filename: string
): Promise<void> {
  const headers = new Headers();
  const token = await getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers });
  } catch {
    throw new StockPilotApiError(
      "Unable to connect to the StockPilot server.",
      0
    );
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type");

    const payload = contentType?.includes("application/json")
      ? await response.json()
      : null;

    throw new StockPilotApiError(
      payload?.message || "The file could not be downloaded.",
      response.status
    );
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(
    () => window.URL.revokeObjectURL(objectUrl),
    1000
  );
}
