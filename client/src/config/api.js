/** Base backend URL, configured via VITE_API_URL in production with localhost fallback. */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/+$/, "");

