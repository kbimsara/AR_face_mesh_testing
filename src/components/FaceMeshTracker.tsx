"use client";

import { useState, useRef } from "react";
import { Camera, FlipHorizontal, Grid3x3, Circle, Aperture, Download } from "lucide-react";
import clsx from "clsx";
import { CameraView } from "@/components/CameraView";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PermissionError } from "@/components/PermissionError";
import { useFaceMesh } from "@/hooks/useFaceMesh";
import type { DrawOptions } from "@/lib/mediapipe";

/**
 * FaceMeshTracker is split into an outer shell (manages retryKey) and an
 * inner core (mounts/unmounts on retry) so the hook's useEffect restarts
 * cleanly without us needing to manually reset state.
 */
export function FaceMeshTracker() {
  const [retryKey, setRetryKey] = useState(0);
  return (
    <FaceMeshTrackerCore
      key={retryKey}
      onRetry={() => setRetryKey((k) => k + 1)}
    />
  );
}

// ─── Inner core ──────────────────────────────────────────────────────────────

interface CoreProps {
  onRetry: () => void;
}

function FaceMeshTrackerCore({ onRetry }: CoreProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI toggles
  const [showMesh, setShowMesh] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);

  const drawOptions: DrawOptions = { showMesh, showLandmarks, mirror };

  const { status, errorMessage, fps, takeScreenshot } = useFaceMesh(
    videoRef,
    canvasRef,
    drawOptions
  );

  const isLoading = status === "idle" || status === "requesting-camera" || status === "loading-model";
  const isReady = status === "ready";

  return (
    <main
      className="relative w-screen h-screen bg-black overflow-hidden"
      aria-label="AR Face Mesh application"
    >
      {/* ── Camera canvas ────────────────────────────────────────────────── */}
      <CameraView videoRef={videoRef} canvasRef={canvasRef} />

      {/* ── Loading overlay ───────────────────────────────────────────────── */}
      {isLoading && <LoadingScreen status={status} />}

      {/* ── Error overlay ─────────────────────────────────────────────────── */}
      {status === "error" && (
        <PermissionError message={errorMessage} onRetry={onRetry} />
      )}

      {/* ── HUD — only visible when ready ─────────────────────────────────── */}
      {isReady && (
        <>
          {/* Scan-line CRT effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
            }}
            aria-hidden="true"
          />

          {/* ── Top bar ─────────────────────────────────────────────────── */}
          <header className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 pointer-events-none z-10">
            {/* Brand */}
            <div className="flex flex-col gap-0.5">
              <span
                className="text-xs font-black tracking-[0.3em] uppercase"
                style={{
                  color: "#00FF41",
                  textShadow: "0 0 12px #00FF41",
                }}
              >
                AR FACE MESH
              </span>
              <span
                className="text-[10px] tracking-[0.15em] uppercase"
                style={{ color: "rgba(0,255,65,0.5)" }}
              >
                MediaPipe · 468 Landmarks
              </span>
            </div>

            {/* FPS counter */}
            <div
              className="flex flex-col items-end gap-0.5"
              aria-label={`${fps} frames per second`}
            >
              <span
                className="text-lg font-black tabular-nums"
                style={{
                  color: fps >= 24 ? "#00FF41" : fps >= 15 ? "#FFD700" : "#EF4444",
                  textShadow: `0 0 8px ${fps >= 24 ? "#00FF41" : fps >= 15 ? "#FFD700" : "#EF4444"}`,
                }}
              >
                {fps}
              </span>
              <span
                className="text-[9px] tracking-widest uppercase"
                style={{ color: "rgba(0,255,65,0.5)" }}
              >
                FPS
              </span>
            </div>
          </header>

          {/* ── Corner brackets ─────────────────────────────────────────── */}
          <CornerBrackets />

          {/* ── Controls toggle button ───────────────────────────────────── */}
          <button
            onClick={() => setControlsVisible((v) => !v)}
            className="absolute bottom-24 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full border border-gray-700 text-gray-500 hover:border-neon hover:text-neon transition-colors focus-visible:outline-none"
            aria-label={controlsVisible ? "Hide controls" : "Show controls"}
            style={{ background: "rgba(0,0,0,0.6)" }}
          >
            <span className="text-xs">{controlsVisible ? "▼" : "▲"}</span>
          </button>

          {/* ── Bottom control bar ───────────────────────────────────────── */}
          <nav
            className={clsx(
              "absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-4 px-4 pb-6 pt-4 transition-transform duration-300",
              !controlsVisible && "translate-y-full"
            )}
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)",
            }}
            aria-label="Camera controls"
          >
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#00FF41", boxShadow: "0 0 6px #00FF41" }}
                aria-hidden="true"
              />
              <span
                className="text-[10px] tracking-[0.2em] uppercase"
                style={{ color: "rgba(0,255,65,0.7)" }}
              >
                Live Tracking
              </span>
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <ControlButton
                icon={<Grid3x3 size={16} />}
                label="Mesh"
                active={showMesh}
                onClick={() => setShowMesh((v) => !v)}
              />
              <ControlButton
                icon={<Circle size={16} />}
                label="Points"
                active={showLandmarks}
                onClick={() => setShowLandmarks((v) => !v)}
              />
              <ControlButton
                icon={<FlipHorizontal size={16} />}
                label="Mirror"
                active={mirror}
                onClick={() => setMirror((v) => !v)}
              />
              <ControlButton
                icon={<Download size={16} />}
                label="Save"
                active={false}
                onClick={takeScreenshot}
                accent="#00BFFF"
              />
              <ControlButton
                icon={<Aperture size={16} />}
                label="Cam"
                active={true}
                onClick={() => {}}
                accent="#00FF41"
                disabled
              />
            </div>
          </nav>

          {/* ── Status indicator (top-left dot) ─────────────────────────── */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-10"
            aria-hidden="true"
          >
            <span
              className="text-[9px] tracking-[0.25em] uppercase px-3 py-1 rounded-full border"
              style={{
                color: "rgba(0,255,65,0.7)",
                borderColor: "rgba(0,255,65,0.25)",
                background: "rgba(0,0,0,0.5)",
              }}
            >
              <Camera size={8} className="inline mr-1.5" />
              Face Detection Active
            </span>
          </div>
        </>
      )}
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
  disabled?: boolean;
}

function ControlButton({
  icon,
  label,
  active,
  onClick,
  accent = "#00FF41",
  disabled = false,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={clsx(
        "flex flex-col items-center gap-1 px-3 py-2 rounded border transition-all duration-200 min-w-[56px]",
        "focus-visible:outline-none focus-visible:ring-2",
        disabled && "opacity-40 cursor-default"
      )}
      style={{
        borderColor: active ? accent : "rgba(255,255,255,0.15)",
        background: active ? `${accent}18` : "rgba(0,0,0,0.5)",
        color: active ? accent : "rgba(255,255,255,0.5)",
        boxShadow: active ? `0 0 12px ${accent}30` : "none",
      }}
    >
      {icon}
      <span className="text-[9px] tracking-widest uppercase font-medium leading-none">
        {label}
      </span>
    </button>
  );
}

/** Animated corner brackets that frame the viewport */
function CornerBrackets() {
  const corners = [
    { pos: "top-4 left-4", rotate: "0deg" },
    { pos: "top-4 right-4", rotate: "90deg" },
    { pos: "bottom-20 right-4", rotate: "180deg" },
    { pos: "bottom-20 left-4", rotate: "270deg" },
  ];

  return (
    <>
      {corners.map(({ pos, rotate }, i) => (
        <div
          key={i}
          className={`absolute ${pos} w-6 h-6 pointer-events-none`}
          style={{ transform: `rotate(${rotate})` }}
          aria-hidden="true"
        >
          <div
            className="absolute top-0 left-0 w-full h-px"
            style={{ background: "#00FF41", boxShadow: "0 0 4px #00FF41" }}
          />
          <div
            className="absolute top-0 left-0 h-full w-px"
            style={{ background: "#00FF41", boxShadow: "0 0 4px #00FF41" }}
          />
        </div>
      ))}
    </>
  );
}
