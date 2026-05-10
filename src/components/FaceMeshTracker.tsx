"use client";

import { useState, useRef } from "react";
import { FlipHorizontal, Grid3x3, Circle, Download, Glasses } from "lucide-react";
import clsx from "clsx";
import { CameraView } from "@/components/CameraView";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PermissionError } from "@/components/PermissionError";
import { useFaceMesh } from "@/hooks/useFaceMesh";
import type { DrawOptions } from "@/lib/mediapipe";
import type { ARGlasses } from "@/lib/ar-glasses";

export function FaceMeshTracker() {
  const [retryKey, setRetryKey] = useState(0);
  return (
    <FaceMeshTrackerCore
      key={retryKey}
      onRetry={() => setRetryKey((k) => k + 1)}
    />
  );
}

interface CoreProps {
  onRetry: () => void;
}

function FaceMeshTrackerCore({ onRetry }: CoreProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showMesh, setShowMesh] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [mirror, setMirror] = useState(true);

  // AR Glasses — loaded lazily when the user picks a GLB file
  const arGlassesRef = useRef<ARGlasses | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [glassesLoaded, setGlassesLoaded] = useState(false);
  const [glassesOn, setGlassesOn] = useState(true);
  const [glassesLoading, setGlassesLoading] = useState(false);

  const drawOptions: DrawOptions = { showMesh, showLandmarks, mirror };

  // Pass arGlassesRef so the hook can composite the overlay each frame.
  // Using a ref means loading a new file never restarts the camera/model.
  const effectiveArRef = glassesOn ? arGlassesRef : { current: null };

  const { status, errorMessage, fps, takeScreenshot } = useFaceMesh(
    videoRef,
    canvasRef,
    drawOptions,
    effectiveArRef
  );

  async function handleGlassesFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGlassesLoading(true);
    try {
      // Lazy-import ARGlasses so Three.js is never bundled until needed
      const { ARGlasses } = await import("@/lib/ar-glasses");
      if (!arGlassesRef.current) {
        arGlassesRef.current = new ARGlasses();
      }
      await arGlassesRef.current.loadFile(file);
      setGlassesLoaded(true);
      setGlassesOn(true);
    } catch (err) {
      console.error("Failed to load GLB:", err);
    } finally {
      setGlassesLoading(false);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    }
  }

  const isLoading = status === "idle" || status === "requesting-camera" || status === "loading-model";
  const isReady = status === "ready";

  return (
    <main
      className="relative w-screen h-screen bg-black overflow-hidden"
      aria-label="AR Face Mesh application"
    >
      <CameraView videoRef={videoRef} canvasRef={canvasRef} />

      {isLoading && <LoadingScreen status={status} />}

      {status === "error" && (
        <PermissionError message={errorMessage} onRetry={onRetry} />
      )}

      {isReady && (
        /* Right-side vertical button panel */
        <nav
          className="absolute top-4 right-4 z-10 flex flex-col items-center gap-2"
          aria-label="Camera controls"
        >
          {/* FPS pill */}
          <div
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center mb-1"
            style={{ background: "rgba(0,0,0,0.55)" }}
            aria-label={`${fps} frames per second`}
          >
            <span className="text-base font-bold tabular-nums text-white leading-none">
              {fps}
            </span>
            <span className="text-[9px] text-gray-400 uppercase tracking-wider leading-none mt-0.5">
              fps
            </span>
          </div>

          <SideButton
            icon={<Grid3x3 size={18} />}
            label="Mesh"
            active={showMesh}
            onClick={() => setShowMesh((v) => !v)}
          />
          <SideButton
            icon={<Circle size={18} />}
            label="Points"
            active={showLandmarks}
            onClick={() => setShowLandmarks((v) => !v)}
          />
          <SideButton
            icon={<FlipHorizontal size={18} />}
            label="Mirror"
            active={mirror}
            onClick={() => setMirror((v) => !v)}
          />
          <SideButton
            icon={<Download size={18} />}
            label="Save"
            active={false}
            onClick={takeScreenshot}
          />

          {/* Divider */}
          <div className="w-8 h-px bg-gray-700 my-1" />

          {/* Glasses button — long-press behaviour:
              if a model is already loaded, toggle it on/off;
              if not loaded, open the file picker */}
          <SideButton
            icon={
              glassesLoading
                ? <span className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin block" />
                : <Glasses size={18} />
            }
            label={glassesLoaded ? (glassesOn ? "On" : "Off") : "Load"}
            active={glassesLoaded && glassesOn}
            onClick={() => {
              if (glassesLoaded) {
                setGlassesOn((v) => !v);
              } else {
                fileInputRef.current?.click();
              }
            }}
          />
          {/* Re-load button — only shown when a model is already loaded */}
          {glassesLoaded && (
            <SideButton
              icon={<span className="text-xs">GLB</span>}
              label="Swap"
              active={false}
              onClick={() => fileInputRef.current?.click()}
            />
          )}

          {/* Hidden file input for GLB selection */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={handleGlassesFile}
            aria-label="Select sunglasses GLB file"
          />
        </nav>
      )}
    </main>
  );
}

interface SideButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function SideButton({ icon, label, active, onClick }: SideButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={clsx(
        "w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      )}
      style={{
        background: active ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.55)",
        color: active ? "#fff" : "rgba(255,255,255,0.5)",
      }}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-wide leading-none">
        {label}
      </span>
    </button>
  );
}
