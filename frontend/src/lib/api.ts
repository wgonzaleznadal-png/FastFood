import axios from "axios";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
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
