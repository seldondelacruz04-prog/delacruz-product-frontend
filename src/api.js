import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:3000/api";
export const API_URL = `${configuredApiUrl.replace(/\/+$/, "").replace(/\/api$/i, "")}/api`;

const api = axios.create({ baseURL: API_URL });

export const session = {
  get access() { return localStorage.getItem("access_token"); },
  get refresh() { return localStorage.getItem("refresh_token"); },
  get user() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  save({ tokens, user }) {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  },
  clear() { ["access_token", "refresh_token", "user"].forEach((k) => localStorage.removeItem(k)); },
};

api.interceptors.request.use((config) => {
  if (session.access) config.headers.Authorization = `Bearer ${session.access}`;
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthCall = original?.url?.includes("/auth/");
    if (err.response?.status === 401 && !original._retry && !isAuthCall && session.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${API_URL}/auth/refresh`, { refresh_token: session.refresh });
        const { data } = await refreshing;
        refreshing = null;
        session.save({ tokens: data.tokens || data });
        original.headers.Authorization = `Bearer ${session.access}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        session.clear();
        window.dispatchEvent(new Event("auth-expired"));
      }
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err) =>
  err.response?.data?.message || err.response?.data?.error || err.message || "Something went wrong.";

export const toList = (body) =>
  Array.isArray(body) ? body : body?.data?.items || body?.data || body?.products || [];

export default api;