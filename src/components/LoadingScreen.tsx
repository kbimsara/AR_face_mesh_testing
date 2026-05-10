"use client";

import type { AppStatus } from "@/lib/mediapipe";

const STATUS_LABEL: Partial<Record<AppStatus, string>> = {
  idle: "Initialising...",
  "requesting-camera": "Requesting camera access...",
  "loading-model": "Loading face detection model...",
};

interface Props {
  status: AppStatus;
}

export function LoadingScreen({ status }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black"
      role="status"
      aria-live="polite"
      aria-label="Loading face mesh application"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,65,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Triple-ring spinner */}
        <div className="relative w-28 h-28">
          {[
            { size: "inset-0", color: "#00FF41", dur: "1s", dir: "normal" },
            { size: "inset-3", color: "#00BFFF", dur: "1.6s", dir: "reverse" },
            { size: "inset-6", color: "#FF00FF", dur: "2.2s", dir: "normal" },
          ].map(({ size, color, dur, dir }, i) => (
            <div
              key={i}
              className={`absolute ${size} rounded-full border-2 border-transparent animate-spin`}
              style={{
                borderTopColor: color,
                animationDuration: dur,
                animationDirection: dir,
              }}
            />
          ))}

          {/* Face icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4.5" stroke="#00FF41" strokeWidth="1.5" />
              <path
                d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"
                stroke="#00FF41"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="9.5" cy="7" r="1" fill="#00FF41" />
              <circle cx="14.5" cy="7" r="1" fill="#00FF41" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1
            className="text-4xl font-black tracking-[0.3em] uppercase"
            style={{
              color: "#00FF41",
              textShadow: "0 0 20px #00FF41, 0 0 40px rgba(0,255,65,0.4)",
            }}
          >
            AR FACE MESH
          </h1>
          <p
            className="text-xs tracking-[0.2em] uppercase"
            style={{ color: "rgba(0,255,65,0.55)" }}
          >
            {STATUS_LABEL[status] ?? "Initialising..."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-px bg-gray-800 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-700"
            style={{
              width:
                status === "loading-model"
                  ? "85%"
                  : status === "requesting-camera"
                  ? "40%"
                  : "10%",
              background: "linear-gradient(90deg, #00FF41, #00BFFF)",
              boxShadow: "0 0 8px #00FF41",
            }}
          />
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-600 tracking-widest">
          MediaPipe Face Mesh · 468 Landmarks
        </p>
      </div>
    </div>
  );
}
