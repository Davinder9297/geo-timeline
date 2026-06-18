export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api/v1",
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000/ws/location",
  GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
};