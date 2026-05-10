# AR Face Mesh — Claude Code Guide

## Project Overview

Browser-only WebAR face tracking app. Next.js 16 (Turbopack), React 19, Tailwind CSS v4, TypeScript strict, MediaPipe Face Mesh 0.4 WASM.

## Commands

```bash
npm run dev        # dev server → http://localhost:3000
npm run build      # production build (Turbopack)
npm start          # serve production build
npx tsc --noEmit   # type-check without compiling
next lint          # ESLint
```

## Architecture

```
src/
├── app/               # Next.js App Router — page.tsx is a server component
├── lib/mediapipe.ts   # CDN URL constant, AppStatus type, color/width constants
├── utils/drawFaceMesh.ts  # drawOneLandmarkSet() — all MediaPipe drawing calls
├── hooks/useFaceMesh.ts   # CORE: camera → dynamic MediaPipe import → rAF loop
└── components/
    ├── FaceMeshTracker.tsx   # Outer retryKey shell + inner core with all UI state
    ├── CameraView.tsx        # Hidden <video> + single <canvas> (cover layout)
    ├── LoadingScreen.tsx     # Triple-ring spinner + progress bar
    └── PermissionError.tsx   # Red error dialog + retry
```

## Critical Constraints

**MediaPipe must always be dynamically imported inside `useEffect`** — it uses browser globals (`window`, `OffscreenCanvas`) and will crash SSR if imported at the module level.

```typescript
// CORRECT — inside useEffect, client-only
const [faceMeshMod, drawingMod] = await Promise.all([
  import("@mediapipe/face_mesh"),
  import("@mediapipe/drawing_utils"),
]);

// WRONG — top-level import will break SSR
import { FaceMesh } from "@mediapipe/face_mesh";
```

**Single canvas renders both video frame and mesh.** `ctx.drawImage(video, ...)` runs first in `fm.onResults()`, then `drawConnectors` / `drawLandmarks` on top. Do not separate them — it would reintroduce `object-fit` alignment bugs.

**Mirror mode uses `ctx.scale(-1, 1)`.** Both the video draw and the mesh draw must share the same canvas transform so coordinates stay aligned.

**Retry pattern:** `FaceMeshTracker` (outer) holds `retryKey`. `FaceMeshTrackerCore` (inner, keyed) mounts/unmounts on retry, which restarts the `useEffect` cleanly without manual state resets.

**Next.js 16 / Turbopack:** `next.config.ts` must declare `turbopack: {}` alongside the `webpack` fallback block, otherwise the build fails with "webpack config but no turbopack config".

## DrawOptions are read via ref, not deps

`useFaceMesh` accepts `drawOptions` as a parameter but reads it via `drawOptionsRef.current` inside the render loop. This lets the parent toggle mesh/landmarks/mirror without the `useEffect` re-running and restarting the camera.

## Tailwind v4 Notes

- Import: `@import "tailwindcss";` in `globals.css` (not `@tailwind base/components/utilities`)
- Custom tokens: `@theme { --color-neon: #00FF41; }` → use as `text-neon`, `bg-neon`, etc.
- PostCSS plugin: `@tailwindcss/postcss` (not `tailwindcss` directly)
- No `tailwind.config.ts` needed for basic setup

## MediaPipe CDN

Model WASM files are loaded from jsDelivr on first use:
```
https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/<file>
```
Requires internet access. Cached by the browser after first load. On a network failure the hook surfaces a user-friendly error message.

## Canvas Cover Layout

`CameraView` uses CSS `min-w-full min-h-full` + dynamic `style.aspectRatio` (set once the video fires `loadedmetadata`) to replicate `object-fit: cover` for a canvas element. Do not use a fixed pixel size — let the video's native dimensions drive `canvas.width` / `canvas.height`.

## Adding New Mesh Features

1. Add a color/width constant in `src/lib/mediapipe.ts`
2. Export the new `FACEMESH_*` constant from the dynamic import in `useFaceMesh.ts` and store it in `drawFnsRef.current`
3. Call `fns.drawConnectors(ctx, landmarks, fns.FACEMESH_XYZ, ...)` inside `drawOneLandmarkSet()` in `drawFaceMesh.ts`
