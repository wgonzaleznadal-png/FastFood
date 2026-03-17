import axios from "axios";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "@/store/authStore";

// Para acceso desde tablet en la misma red: usa el host de la página (ej: 192.168.x.x:4000)
const getApiBaseUrl = () =>
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:4000`
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL) {
    config.baseURL = getApiBaseUrl();
  }
  return config;
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refreshToken, clearAuth } = useAuthStore.getState();

      if (!refreshToken) {
        clearAuth();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post("/api/auth/refresh", { refreshToken });
        const store = useAuthStore.getState();
        store.setAuth(data.token, data.user, data.tenant, data.refreshToken ?? store.refreshToken ?? undefined);
        processQueue(null, data.token);
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
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
