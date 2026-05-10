import { MESH_COLORS, MESH_WIDTHS } from "@/lib/mediapipe";

/** Snapshot of the dynamically-imported MediaPipe drawing helpers */
export interface DrawFns {
  drawConnectors: (
    ctx: CanvasRenderingContext2D,
    landmarks: unknown[],
    connections: unknown,
    style: { color: string; lineWidth: number }
  ) => void;
  drawLandmarks: (
    ctx: CanvasRenderingContext2D,
    landmarks: unknown[],
    style: { color: string; lineWidth: number; radius: number }
  ) => void;
  FACEMESH_TESSELATION: unknown;
  FACEMESH_FACE_OVAL: unknown;
  FACEMESH_RIGHT_EYE: unknown;
  FACEMESH_LEFT_EYE: unknown;
  FACEMESH_RIGHT_EYEBROW: unknown;
  FACEMESH_LEFT_EYEBROW: unknown;
  FACEMESH_LIPS: unknown;
}

/** Draw one set of face landmarks onto the canvas context */
export function drawOneLandmarkSet(
  ctx: CanvasRenderingContext2D,
  landmarks: unknown[],
  fns: DrawFns,
  showMesh: boolean,
  showLandmarks: boolean
) {
  if (showMesh) {
    // Subtle tessellation fill
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_TESSELATION, {
      color: MESH_COLORS.tesselation,
      lineWidth: MESH_WIDTHS.tesselation,
    });
    // Face boundary — bright neon green
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_FACE_OVAL, {
      color: MESH_COLORS.oval,
      lineWidth: MESH_WIDTHS.oval,
    });
    // Eyes — cyber blue
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_RIGHT_EYE, {
      color: MESH_COLORS.eyes,
      lineWidth: MESH_WIDTHS.features,
    });
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_LEFT_EYE, {
      color: MESH_COLORS.eyes,
      lineWidth: MESH_WIDTHS.features,
    });
    // Eyebrows — gold
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_RIGHT_EYEBROW, {
      color: MESH_COLORS.eyebrows,
      lineWidth: MESH_WIDTHS.features,
    });
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_LEFT_EYEBROW, {
      color: MESH_COLORS.eyebrows,
      lineWidth: MESH_WIDTHS.features,
    });
    // Lips — magenta
    fns.drawConnectors(ctx, landmarks, fns.FACEMESH_LIPS, {
      color: MESH_COLORS.lips,
      lineWidth: MESH_WIDTHS.features,
    });
  }

  if (showLandmarks) {
    fns.drawLandmarks(ctx, landmarks, {
      color: MESH_COLORS.landmarks,
      lineWidth: MESH_WIDTHS.landmarks,
      radius: 1,
    });
  }
}
