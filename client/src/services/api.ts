import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
let refreshRequest: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/refresh');
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthRequest) {
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      if (!refreshRequest) {
        refreshRequest = axios.post(`${baseURL}/auth/refresh`, { refreshToken })
          .then(response => {
            const { accessToken, refreshToken: nextRefreshToken } = response.data;
            useAuthStore.getState().updateTokens(accessToken, nextRefreshToken);
            return accessToken as string;
          })
          .finally(() => { refreshRequest = null; });
      }
      const accessToken = await refreshRequest;
      if (requestUrl.includes('/auth/logout')) {
        originalRequest.data = JSON.stringify({ refreshToken: useAuthStore.getState().refreshToken });
      }
      if (!originalRequest.headers) originalRequest.headers = {} as typeof originalRequest.headers;
      (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
