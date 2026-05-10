"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { AppStatus, DrawOptions } from "@/lib/mediapipe";
import { MEDIAPIPE_CDN } from "@/lib/mediapipe";
import { drawOneLandmarkSet, type DrawFns } from "@/utils/drawFaceMesh";
import type { ARGlasses } from "@/lib/ar-glasses";

export interface UseFaceMeshReturn {
  status: AppStatus;
  errorMessage: string;
  fps: number;
  takeScreenshot: () => void;
}

/**
 * Core hook that:
 *  1. Opens the user's webcam
 *  2. Dynamically imports and initialises MediaPipe FaceMesh
 *  3. Drives a requestAnimationFrame render loop that sends video frames to
 *     FaceMesh and draws results on the shared canvas
 *
 * The hook is intentionally initialised only once (empty dep array). Changes to
 * drawOptions are reflected via a ref so the effect never needs to re-run.
 */
export function useFaceMesh(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  drawOptions: DrawOptions,
  /** Optional AR glasses instance — read via ref, never triggers effect re-run */
  arGlassesRef?: RefObject<ARGlasses | null>
): UseFaceMeshReturn {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fps, setFps] = useState(0);

  // Keep the latest drawOptions accessible inside callbacks without re-running the effect
  const drawOptionsRef = useRef<DrawOptions>(drawOptions);
  drawOptionsRef.current = drawOptions;

  const drawFnsRef = useRef<DrawFns | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<{ send: (i: { image: HTMLVideoElement }) => Promise<void>; close: () => void } | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let animFrameId = 0;
    const frameTimes: number[] = [];
    let lastFpsUpdate = 0;

    /** Main render loop — driven by requestAnimationFrame */
    async function renderLoop() {
      if (cancelled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const fm = faceMeshRef.current;

      if (
        video &&
        canvas &&
        fm &&
        video.readyState >= 2 &&
        !isProcessingRef.current
      ) {
        isProcessingRef.current = true;

        // Keep canvas pixel size in sync with the live video resolution
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        try {
          // send() resolves after onResults() has been called synchronously
          await fm.send({ image: video });
        } catch {
          // Ignore individual frame errors; model will recover next frame
        } finally {
          isProcessingRef.current = false;
        }

        // FPS counter — rolling 1-second window, update every 500 ms
        const now = performance.now();
        frameTimes.push(now);
        while (frameTimes.length > 0 && now - frameTimes[0] > 1000) {
          frameTimes.shift();
        }
        if (now - lastFpsUpdate > 500) {
          setFps(frameTimes.length);
          lastFpsUpdate = now;
        }
      }

      animFrameId = requestAnimationFrame(renderLoop);
    }

    async function init() {
      try {
        // ── Step 1: camera ────────────────────────────────────────────────
        setStatus("requesting-camera");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",   // front camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
          video.onerror = () => reject(new Error("Video element error"));
        });

        if (cancelled) return;

        // ── Step 2: MediaPipe model ───────────────────────────────────────
        setStatus("loading-model");

        // Dynamic import keeps MediaPipe out of the SSR bundle
        const [faceMeshMod, drawingMod] = await Promise.all([
          import("@mediapipe/face_mesh"),
          import("@mediapipe/drawing_utils"),
        ]);

        if (cancelled) return;

        const {
          FaceMesh,
          FACEMESH_TESSELATION,
          FACEMESH_FACE_OVAL,
          FACEMESH_RIGHT_EYE,
          FACEMESH_LEFT_EYE,
          FACEMESH_RIGHT_EYEBROW,
          FACEMESH_LEFT_EYEBROW,
          FACEMESH_LIPS,
        } = faceMeshMod as {
          FaceMesh: new (cfg: { locateFile: (f: string) => string }) => {
            setOptions: (o: Record<string, unknown>) => void;
            onResults: (cb: (r: { multiFaceLandmarks?: unknown[][] }) => void) => void;
            initialize: () => Promise<void>;
            send: (i: { image: HTMLVideoElement }) => Promise<void>;
            close: () => void;
          };
          FACEMESH_TESSELATION: unknown;
          FACEMESH_FACE_OVAL: unknown;
          FACEMESH_RIGHT_EYE: unknown;
          FACEMESH_LEFT_EYE: unknown;
          FACEMESH_RIGHT_EYEBROW: unknown;
          FACEMESH_LEFT_EYEBROW: unknown;
          FACEMESH_LIPS: unknown;
        };

        const { drawConnectors, drawLandmarks } = drawingMod as {
          drawConnectors: DrawFns["drawConnectors"];
          drawLandmarks: DrawFns["drawLandmarks"];
        };

        drawFnsRef.current = {
          drawConnectors,
          drawLandmarks,
          FACEMESH_TESSELATION,
          FACEMESH_FACE_OVAL,
          FACEMESH_RIGHT_EYE,
          FACEMESH_LEFT_EYE,
          FACEMESH_RIGHT_EYEBROW,
          FACEMESH_LEFT_EYEBROW,
          FACEMESH_LIPS,
        };

        // Load WASM + model files from CDN
        const fm = new FaceMesh({
          locateFile: (file: string) => `${MEDIAPIPE_CDN}/${file}`,
        });

        fm.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        // ── onResults: draw video frame + mesh overlay ────────────────────
        fm.onResults((results) => {
          const canvas = canvasRef.current;
          const vid = videoRef.current;
          const fns = drawFnsRef.current;
          if (!canvas || !vid || !fns) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const opts = drawOptionsRef.current;

          ctx.save();

          // Mirror mode: flip coordinate system before drawing
          if (opts.mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }

          // Draw the raw video frame as the background
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

          ctx.restore();

          // Draw mesh — MediaPipe uses normalised coords so the ctx transform
          // above automatically mirrors landmark positions too
          if (results.multiFaceLandmarks?.length) {
            ctx.save();
            if (opts.mirror) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }
            for (const landmarks of results.multiFaceLandmarks) {
              drawOneLandmarkSet(
                ctx,
                landmarks as unknown[],
                fns,
                opts.showMesh,
                opts.showLandmarks
              );
            }
            ctx.restore();

            // ── AR Glasses overlay ────────────────────────────────────────
            // The glasses are rendered in raw (non-mirrored) landmark space
            // and composited with the same mirror transform as video/mesh.
            const glasses = arGlassesRef?.current;
            if (glasses?.hasModel) {
              const lm = results.multiFaceLandmarks[0] as Array<{
                x: number; y: number; z: number;
              }>;
              glasses.resize(canvas.width, canvas.height);
              glasses.updatePose(lm);
              glasses.render();

              ctx.save();
              if (opts.mirror) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(glasses.canvas, 0, 0);
              ctx.restore();
            }
          }
        });

        await fm.initialize();

        if (cancelled) {
          fm.close();
          return;
        }

        faceMeshRef.current = fm;
        setStatus("ready");

        // Kick off the render loop
        animFrameId = requestAnimationFrame(renderLoop);
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(describeError(err));
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      faceMeshRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Composite video + mesh into a PNG and trigger a browser download */
  function takeScreenshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    if (drawOptionsRef.current.mirror) {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, out.width, out.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Overlay the mesh canvas (already includes mirror if active)
    ctx.drawImage(canvas, 0, 0);

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `face-mesh-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return { status, errorMessage, fps, takeScreenshot };
}

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred.";
  switch (err.name) {
    case "NotAllowedError":
      return "Camera access was denied. Please allow camera permission and refresh the page.";
    case "NotFoundError":
      return "No camera found. Please connect a webcam and try again.";
    case "NotSupportedError":
      return "Your browser does not support camera access. Please use Chrome, Edge, or Safari 14+.";
    case "OverconstrainedError":
      return "The requested camera resolution is not supported by your device.";
    default:
      return err.message || "An unexpected error occurred.";
  }
}
