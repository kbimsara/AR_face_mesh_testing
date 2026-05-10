"use client";

import { type RefObject, useEffect } from "react";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Renders a hidden <video> (frame source for MediaPipe) and a full-cover
 * <canvas> that displays both the video frame and the face mesh overlay.
 *
 * The canvas is styled to behave like object-fit:cover — it fills the
 * container while maintaining its aspect ratio.
 */
export function CameraView({ videoRef, canvasRef }: Props) {
  // Once the video knows its native dimensions, make the canvas adopt that
  // aspect-ratio so CSS min-w-full + min-h-full gives us cover behaviour.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    function syncAspectRatio() {
      if (!video || !canvas) return;
      if (video.videoWidth && video.videoHeight) {
        canvas.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      }
    }

    video.addEventListener("loadedmetadata", syncAspectRatio);
    return () => video.removeEventListener("loadedmetadata", syncAspectRatio);
  }, [videoRef, canvasRef]);

  return (
    /* overflow-hidden clips the canvas when it overshoots the container edge */
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {/* Hidden video — provides frames to canvas via ctx.drawImage(video) */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {/*
        Canvas covers the viewport.
        min-w-full + min-h-full with width/height:auto + aspect-ratio mimics
        object-fit:cover without distortion.
      */}
      <canvas
        ref={canvasRef}
        className="min-w-full min-h-full"
        style={{ width: "auto", height: "auto" }}
        aria-label="Live face mesh augmented reality view"
      />
    </div>
  );
}
