/** CDN base URL for MediaPipe Face Mesh WASM/model files */
export const MEDIAPIPE_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619";

export type AppStatus =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "ready"
  | "error";

export interface DrawOptions {
  showMesh: boolean;
  showLandmarks: boolean;
  mirror: boolean;
}

/** Neon color palette for the cyberpunk overlay */
export const MESH_COLORS = {
  tesselation: "rgba(0, 255, 65, 0.12)",
  oval: "#00FF41",
  eyes: "#00BFFF",
  eyebrows: "#FFD700",
  lips: "#FF00FF",
  landmarks: "#00FF41",
} as const;

export const MESH_WIDTHS = {
  tesselation: 0.5,
  oval: 2,
  features: 1.5,
  landmarks: 0.5,
} as const;
