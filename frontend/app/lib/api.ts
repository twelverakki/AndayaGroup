import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send HTTP-Only cookies with every request
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor to handle session expiration (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token/session or redirect if not on login page
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = "/login?expired=true";
      }
    }
    return Promise.reject(error);
  }
);
