import axios from "axios";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "@/store/authStore";

// Asegura URL absoluta con protocolo (evita que el browser la trate como relativa)
const normalizeApiUrl = (url: string) => {
  const u = (url || "").trim();
  if (!u) return "http://localhost:4000";
  return u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`;
};

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL) {
    return `http://${window.location.hostname}:4000/api/v1`;
  }
  return `${normalizeApiUrl(env)}/api/v1`;
}

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL) {
    config.baseURL = `http://${window.location.hostname}:4000/api/v1`;
  }
  return config;
});

// Token sent via httpOnly cookie when withCredentials: true

/**
 * El backend rota el refresh token en cada POST /auth/refresh. Dos llamadas concurrentes
 * con el mismo cookie hacen que la segunda falle con 401 y dispare clearAuth (síntoma: “entra y me saca”).
 */
let refreshSessionPromise: Promise<void> | null = null;

export async function refreshSessionOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      try {
        const { data } = await api.post("/auth/refresh");
        if (data?.user && data?.tenant) {
          useAuthStore.getState().setAuth(data.user, data.tenant);
        }
      } finally {
        refreshSessionPromise = null;
      }
    })();
  }
  await refreshSessionPromise;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

function isAuthRefreshRequest(config: { url?: string } | undefined): boolean {
  const u = String(config?.url ?? "");
  return u.includes("/auth/refresh");
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const { clearAuth } = useAuthStore.getState();

      if (isAuthRefreshRequest(originalRequest)) {
        processQueue(error, null);
        clearAuth();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await refreshSessionOnce();
        processQueue(null, null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuth();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (process.env.NODE_ENV === "development" && error.response?.status === 500) {
      console.error("[API Error]", error.response?.data);
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err: unknown, fallback = "Ocurrió un error inesperado") {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function showApiError(err: unknown, fallback = "Ocurrió un error inesperado") {
  notifications.show({ title: "Error", message: getApiErrorMessage(err, fallback), color: "red" });
}
