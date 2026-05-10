"use client";

import type { AppStatus } from "@/lib/mediapipe";

const STATUS_LABEL: Partial<Record<AppStatus, string>> = {
  idle: "Starting…",
  "requesting-camera": "Requesting camera…",
  "loading-model": "Loading model…",
};

interface Props {
  status: AppStatus;
}

export function LoadingScreen({ status }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black gap-4"
      role="status"
      aria-live="polite"
    >
      {/* Simple spinner */}
      <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-white animate-spin" />

      <p className="text-sm text-gray-400">
        {STATUS_LABEL[status] ?? "Starting…"}
      </p>
    </div>
  );
}
