# AR Face Mesh — Verification & Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the initial build works end-to-end in a real browser, then layer in five meaningful enhancements: iris highlighting, no-face indicator, CDN error handling, mobile camera-flip, and face-proximity hint.

**Architecture:** All interactive code lives in client components/hooks (`"use client"`). MediaPipe is dynamically imported inside `useEffect` to stay out of the SSR bundle. A single `<canvas>` acts as the combined video + mesh display — both are drawn in the `fm.onResults()` callback so coordinates always align. State changes to draw options (mesh, landmarks, mirror) are reflected through a ref so the MediaPipe effect never needs to re-run.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript 5 (strict), Tailwind CSS v4, MediaPipe Face Mesh 0.4 (WASM loaded from jsDelivr CDN), lucide-react, clsx.

---

## File Map

| File | Role | Task |
|---|---|---|
| `src/hooks/useFaceMesh.ts` | Core camera + model + render loop | Tasks 2, 3, 5, 6 |
| `src/lib/mediapipe.ts` | CDN URL, types, color/width constants | Task 3, 5 |
| `src/utils/drawFaceMesh.ts` | `drawOneLandmarkSet()` drawing helper | Task 2 |
| `src/components/FaceMeshTracker.tsx` | Outer shell (retryKey) + inner core (all UI state) | Tasks 4, 5, 6 |
| `src/components/CameraView.tsx` | Hidden `<video>` + `<canvas>` cover layout | (read-only ref) |
| `src/components/LoadingScreen.tsx` | Triple-ring spinner + progress bar | (read-only ref) |
| `src/components/PermissionError.tsx` | Red error dialog + retry | (read-only ref) |
| `src/components/ProximityHint.tsx` | NEW — "Move closer / back" floating badge | Task 5 |
| `src/components/NoFaceIndicator.tsx` | NEW — pulsing "scanning" badge | Task 4 |

---

## Task 1 — End-to-End Browser Verification

**Files:** none (manual verification pass)

- [ ] **Step 1.1: Start dev server**

```bash
npm run dev
```

Expected terminal output contains:
```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

- [ ] **Step 1.2: Open the app and accept camera permission**

Navigate to `http://localhost:3000`.

Expected sequence:
1. Black screen with neon-green triple-ring spinner appears immediately.
2. Status text transitions: "Initialising…" → "Requesting camera access…" → "Loading face detection model…"
3. The progress bar advances from ~10 % to ~85 %.
4. Once the model loads (~5–15 s on first run, cached thereafter) the camera feed appears full-screen.

- [ ] **Step 1.3: Verify face mesh renders**

Position your face in the camera frame.

Expected:
- Face oval: bright neon-green outline around the face boundary.
- Tessellation: faint green grid across the face.
- Eyes: cyan/blue connectors.
- Eyebrows: gold connectors.
- Lips: magenta connectors.
- FPS counter (top-right) shows a number ≥ 15.

- [ ] **Step 1.4: Toggle each control button**

| Button | Expected behaviour |
|--------|-------------------|
| **Mesh** (off) | All connectors + tessellation disappear; raw camera feed only |
| **Mesh** (on again) | Mesh reappears |
| **Points** (on) | 468 small green dots appear over landmarks |
| **Points** (off) | Dots disappear |
| **Mirror** (off) | Feed flips — text in background appears readable (non-mirrored) |
| **Mirror** (on again) | Feed flips back to selfie orientation |
| **Save** | Browser downloads a PNG named `face-mesh-<timestamp>.png`; file contains both video frame and mesh overlay |
| **▼ / ▲ button** (bottom-right) | Control bar slides off-screen / back |

- [ ] **Step 1.5: Verify error flow**

In Chrome: DevTools → Application → Camera → Block  
Refresh the page.

Expected:
- Red error dialog appears with text "Camera access was denied…"
- **Retry** button is present.
- Clicking Retry unblocks and restarts the init sequence (or shows the error again if the block is still active).

- [ ] **Step 1.6: Commit baseline verification**

```bash
git add -A
git commit -m "feat: initial AR face mesh build — Next.js 16 + MediaPipe"
```

---

## Task 2 — Iris Tracking Highlight

`refineLandmarks: true` is already set, which adds FACEMESH_IRISES landmarks (around index 468–477). Surface them as a distinctive highlight.

**Files:**
- Modify: `src/lib/mediapipe.ts`
- Modify: `src/utils/drawFaceMesh.ts`
- Modify: `src/hooks/useFaceMesh.ts` (pass FACEMESH_IRISES through drawFnsRef)

- [ ] **Step 2.1: Add iris color constant to `src/lib/mediapipe.ts`**

Add inside the `MESH_COLORS` object (after `lips`):

```typescript
irises: "#00FFFF",
```

And add to `MESH_WIDTHS` (after `landmarks`):

```typescript
irises: 2,
```

- [ ] **Step 2.2: Add `FACEMESH_IRISES` to the `DrawFns` interface in `src/utils/drawFaceMesh.ts`**

Locate the `DrawFns` interface and add the new property:

```typescript
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
  FACEMESH_IRISES: unknown;   // ← add this
}
```

- [ ] **Step 2.3: Draw irises in `drawOneLandmarkSet()` inside `src/utils/drawFaceMesh.ts`**

Inside `drawOneLandmarkSet`, at the end of the `if (showMesh)` block (after the lips connector call), add:

```typescript
    // Iris rings — only present with refineLandmarks: true
    if (fns.FACEMESH_IRISES) {
      fns.drawConnectors(ctx, landmarks, fns.FACEMESH_IRISES, {
        color: MESH_COLORS.irises,
        lineWidth: MESH_WIDTHS.irises,
      });
    }
```

- [ ] **Step 2.4: Export `FACEMESH_IRISES` from the dynamic import in `src/hooks/useFaceMesh.ts`**

In the destructuring block that starts `const { FaceMesh, FACEMESH_TESSELATION, ...`, add `FACEMESH_IRISES`:

```typescript
        const {
          FaceMesh,
          FACEMESH_TESSELATION,
          FACEMESH_FACE_OVAL,
          FACEMESH_RIGHT_EYE,
          FACEMESH_LEFT_EYE,
          FACEMESH_RIGHT_EYEBROW,
          FACEMESH_LEFT_EYEBROW,
          FACEMESH_LIPS,
          FACEMESH_IRISES,   // ← add this
        } = faceMeshMod as { /* ... existing cast ... */
          FACEMESH_IRISES: unknown;   // ← add to cast object too
        };
```

Then add `FACEMESH_IRISES` to the `drawFnsRef.current = { ... }` assignment:

```typescript
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
          FACEMESH_IRISES,   // ← add this
        };
```

- [ ] **Step 2.5: Verify iris rings appear**

Run `npm run dev`, open the app, enable the **Mesh** toggle.  
Expected: Two bright cyan rings appear centred on each iris when looking at the camera.

- [ ] **Step 2.6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/mediapipe.ts src/utils/drawFaceMesh.ts src/hooks/useFaceMesh.ts
git commit -m "feat: add iris tracking highlight with FACEMESH_IRISES"
```

---

## Task 3 — CDN / Network Error Handling

If the jsDelivr CDN is unreachable (offline, firewall, rate-limited) MediaPipe throws a cryptic fetch error. Surface a human-readable message.

**Files:**
- Modify: `src/hooks/useFaceMesh.ts` (the `describeError` function at the bottom)

- [ ] **Step 3.1: Extend `describeError` in `src/hooks/useFaceMesh.ts`**

Replace the existing `describeError` function (at the bottom of the file) with:

```typescript
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred.";

  // MediaPipe WASM / model fetch failures
  if (
    err.message.includes("Failed to fetch") ||
    err.message.includes("NetworkError") ||
    err.message.includes("net::ERR") ||
    err.message.includes("cdn.jsdelivr") ||
    err.message.includes("face_mesh")
  ) {
    return (
      "Could not download the face detection model. " +
      "Please check your internet connection and refresh the page. " +
      "(Model is loaded from jsDelivr CDN on first use.)"
    );
  }

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
```

- [ ] **Step 3.2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3.3: Commit**

```bash
git add src/hooks/useFaceMesh.ts
git commit -m "fix: improve CDN/network error message for MediaPipe load failure"
```

---

## Task 4 — "No Face Detected" Scanning Indicator

When the camera is live but no face appears in the frame, show a pulsing badge so the user knows the app is running and waiting.

**Files:**
- Create: `src/components/NoFaceIndicator.tsx`
- Modify: `src/hooks/useFaceMesh.ts` (expose `faceDetected` boolean)
- Modify: `src/components/FaceMeshTracker.tsx` (render the badge)

- [ ] **Step 4.1: Expose `faceDetected` from `useFaceMesh`**

In `src/hooks/useFaceMesh.ts`, add state and return value:

```typescript
// Inside the function, after the existing useState calls:
const [faceDetected, setFaceDetected] = useState(false);
```

Inside `fm.onResults()` callback, update the face-detected state (add after the `if (!canvas || !vid || !fns) return;` guard):

```typescript
          // Notify UI whether a face is currently in frame
          const hasFace = (results.multiFaceLandmarks?.length ?? 0) > 0;
          setFaceDetected(hasFace);
```

Update the `UseFaceMeshReturn` interface to include the new field:

```typescript
export interface UseFaceMeshReturn {
  status: AppStatus;
  errorMessage: string;
  fps: number;
  faceDetected: boolean;   // ← add
  takeScreenshot: () => void;
}
```

Update the return statement at the bottom of the hook:

```typescript
  return { status, errorMessage, fps, faceDetected, takeScreenshot };
```

- [ ] **Step 4.2: Create `src/components/NoFaceIndicator.tsx`**

```typescript
"use client";

interface Props {
  visible: boolean;
}

export function NoFaceIndicator({ visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center gap-3"
      aria-live="polite"
      aria-label="Scanning for face"
    >
      {/* Animated scanner ring */}
      <div className="relative w-32 h-32">
        <div
          className="absolute inset-0 rounded-full border border-dashed animate-spin"
          style={{
            borderColor: "rgba(0,255,65,0.4)",
            animationDuration: "3s",
          }}
        />
        <div
          className="absolute inset-4 rounded-full border border-dashed animate-spin"
          style={{
            borderColor: "rgba(0,191,255,0.3)",
            animationDuration: "2s",
            animationDirection: "reverse",
          }}
        />
        {/* Centre dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#00FF41", boxShadow: "0 0 8px #00FF41" }}
          />
        </div>
      </div>

      <span
        className="text-[10px] tracking-[0.25em] uppercase"
        style={{ color: "rgba(0,255,65,0.6)" }}
      >
        Scanning…
      </span>
    </div>
  );
}
```

- [ ] **Step 4.3: Wire `NoFaceIndicator` into `FaceMeshTrackerCore` in `src/components/FaceMeshTracker.tsx`**

Add the import at the top of the file:

```typescript
import { NoFaceIndicator } from "@/components/NoFaceIndicator";
```

Destructure `faceDetected` from the hook call (line that calls `useFaceMesh`):

```typescript
  const { status, errorMessage, fps, faceDetected, takeScreenshot } = useFaceMesh(
    videoRef,
    canvasRef,
    drawOptions
  );
```

Inside the `{isReady && ( ... )}` JSX block, after the `<CameraView />` line and before the HUD header, add:

```tsx
          {/* No-face scanning indicator */}
          <NoFaceIndicator visible={!faceDetected} />
```

- [ ] **Step 4.4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4.5: Verify in browser**

1. Start the app with `npm run dev`.
2. Point the camera away from your face (at the ceiling or wall).
3. Expected: rotating dashed rings + "Scanning…" text appear in the centre.
4. Point the camera back at your face.
5. Expected: rings disappear immediately once a face is detected.

- [ ] **Step 4.6: Commit**

```bash
git add src/hooks/useFaceMesh.ts src/components/NoFaceIndicator.tsx src/components/FaceMeshTracker.tsx
git commit -m "feat: add no-face scanning indicator"
```

---

## Task 5 — Face Proximity Indicator

Calculate the normalised height of the face oval to infer distance, and surface a "Move closer" / "Move back" hint.

**Files:**
- Create: `src/components/ProximityHint.tsx`
- Modify: `src/hooks/useFaceMesh.ts` (compute + expose `proximityLevel`)
- Modify: `src/components/FaceMeshTracker.tsx` (render hint)

- [ ] **Step 5.1: Add `proximityLevel` state to `src/hooks/useFaceMesh.ts`**

Add the state after existing useState calls:

```typescript
  const [proximityLevel, setProximityLevel] = useState<"close" | "ok" | "far" | null>(null);
```

Inside `fm.onResults()`, after the existing `setFaceDetected(hasFace);` line, compute proximity from the face oval bounding box:

```typescript
          if (hasFace && results.multiFaceLandmarks?.[0]) {
            const lm = results.multiFaceLandmarks[0] as Array<{ x: number; y: number }>;
            const ys = lm.map((p) => p.y);
            const faceHeight = Math.max(...ys) - Math.min(...ys); // normalised 0–1
            if (faceHeight > 0.55) {
              setProximityLevel("close");
            } else if (faceHeight < 0.25) {
              setProximityLevel("far");
            } else {
              setProximityLevel("ok");
            }
          } else {
            setProximityLevel(null);
          }
```

Add `proximityLevel` to the interface and return:

```typescript
export interface UseFaceMeshReturn {
  status: AppStatus;
  errorMessage: string;
  fps: number;
  faceDetected: boolean;
  proximityLevel: "close" | "ok" | "far" | null;   // ← add
  takeScreenshot: () => void;
}

// return statement:
  return { status, errorMessage, fps, faceDetected, proximityLevel, takeScreenshot };
```

- [ ] **Step 5.2: Create `src/components/ProximityHint.tsx`**

```typescript
"use client";

interface Props {
  level: "close" | "ok" | "far" | null;
}

const CONFIG = {
  close: { label: "← Move Back →",  color: "#FFD700" },
  far:   { label: "→ Move Closer ←", color: "#00BFFF" },
  ok:    { label: "✓ Good Distance",  color: "#00FF41" },
} as const;

export function ProximityHint({ level }: Props) {
  if (!level || level === "ok") return null;

  const { label, color } = CONFIG[level];

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-20"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className="text-[11px] tracking-[0.2em] uppercase px-4 py-1.5 rounded-full border"
        style={{
          color,
          borderColor: `${color}60`,
          background: "rgba(0,0,0,0.65)",
          textShadow: `0 0 8px ${color}`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 5.3: Wire `ProximityHint` into `FaceMeshTrackerCore`**

Add the import:

```typescript
import { ProximityHint } from "@/components/ProximityHint";
```

Destructure from hook:

```typescript
  const { status, errorMessage, fps, faceDetected, proximityLevel, takeScreenshot } = useFaceMesh(
    videoRef,
    canvasRef,
    drawOptions
  );
```

Inside the `{isReady && ( ... )}` block, directly after `<NoFaceIndicator visible={!faceDetected} />`:

```tsx
          <ProximityHint level={proximityLevel} />
```

- [ ] **Step 5.4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5.5: Verify in browser**

1. Start `npm run dev`.
2. Sit far from camera (> arm's length).
3. Expected: cyan "→ Move Closer ←" badge below the top bar.
4. Move very close (< 30 cm).
5. Expected: gold "← Move Back →" badge.
6. Sit at normal webcam distance.
7. Expected: badge disappears.

- [ ] **Step 5.6: Commit**

```bash
git add src/hooks/useFaceMesh.ts src/components/ProximityHint.tsx src/components/FaceMeshTracker.tsx
git commit -m "feat: add face proximity hint (move closer/back)"
```

---

## Task 6 — Mobile Camera Flip Button

On mobile devices, `getUserMedia` supports `facingMode: 'environment'` for the rear camera. Add a toggle button that restarts the stream with the opposite facing mode.

**Files:**
- Modify: `src/hooks/useFaceMesh.ts` (accept `facingMode` param, expose `flipCamera`)
- Modify: `src/components/FaceMeshTracker.tsx` (hold `facingMode` state, pass to hook, show button on mobile)

- [ ] **Step 6.1: Parameterise `facingMode` in the hook**

The hook currently hardcodes `facingMode: "user"`. Change the signature to accept an optional parameter and expose a flip callback.

Add `facingMode` to the hook's parameter list in `src/hooks/useFaceMesh.ts`:

```typescript
export function useFaceMesh(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  drawOptions: DrawOptions,
  facingMode: "user" | "environment" = "user"   // ← add
): UseFaceMeshReturn {
```

The hook's `useEffect` currently has an empty dependency array. Adding `facingMode` as a dependency lets it restart the camera when it changes. Update the `getUserMedia` call:

```typescript
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,          // ← was hardcoded "user"
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
```

Change the `useEffect` dependency array from `[]` to `[facingMode]`:

```typescript
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);
```

Remove `flipCamera` from `UseFaceMeshReturn` — the flip is managed by the parent component's state (simpler).

- [ ] **Step 6.2: Add `facingMode` state and flip button in `FaceMeshTrackerCore`**

In `src/components/FaceMeshTracker.tsx`, add state after the existing toggle states:

```typescript
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
```

Pass it to the hook:

```typescript
  const { status, errorMessage, fps, faceDetected, proximityLevel, takeScreenshot } = useFaceMesh(
    videoRef,
    canvasRef,
    drawOptions,
    facingMode   // ← add
  );
```

Add a flip `ControlButton` inside the control bar's button row (after the **Mirror** button):

```tsx
              <ControlButton
                icon={<Camera size={16} />}
                label="Flip"
                active={facingMode === "environment"}
                onClick={() =>
                  setFacingMode((m) =>
                    m === "user" ? "environment" : "user"
                  )
                }
                accent="#FF00FF"
              />
```

> **Note:** This button is useful on mobile. On desktop it can be ignored — a second `getUserMedia` call with `facingMode: environment` will either reuse the same camera or fail gracefully (the existing error handler will show "OverconstrainedError").

- [ ] **Step 6.3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6.4: Verify on mobile (or DevTools mobile emulation)**

1. In Chrome DevTools → Device toolbar → select a phone.
2. Reload `http://localhost:3000` (you must be on the same LAN — use your machine's IP address, not `localhost`, from the phone, or use DevTools device emulation with a real phone USB-connected).
3. Accept camera permission.
4. Tap **Flip** — the view should switch to the rear camera.
5. Tap **Flip** again — front camera returns.

- [ ] **Step 6.5: Commit**

```bash
git add src/hooks/useFaceMesh.ts src/components/FaceMeshTracker.tsx
git commit -m "feat: add mobile camera-flip button (front/rear toggle)"
```

---

## Task 7 — Production Build & Deployment Verification

**Files:** none (scripts only)

- [ ] **Step 7.1: Run production build**

```bash
npm run build
```

Expected final lines:
```
✓ Compiled successfully
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content
```

If the build fails, check:
- `npx tsc --noEmit` for type errors
- Any import that references a browser global (`window`, `document`) outside a `"use client"` + `useEffect` guard

- [ ] **Step 7.2: Smoke-test the production build locally**

```bash
npm start
```

Open `http://localhost:3000`. Verify camera + mesh still work under the production bundle (Turbopack production vs dev can behave differently for dynamic imports).

- [ ] **Step 7.3: Deploy to Vercel (optional)**

```bash
# Install Vercel CLI if not present
npm i -g vercel

vercel --prod
```

Follow the prompts:
- Project name: `ar-face-mesh` (or your choice)
- Framework: Next.js (auto-detected)
- Root directory: `.`

The deployed URL will support HTTPS, which is **required** for `getUserMedia` in production (cameras are blocked on HTTP except `localhost`).

- [ ] **Step 7.4: Commit final state**

```bash
git add -A
git commit -m "chore: production build verified — all enhancements complete"
```

---

## Self-Review Checklist

**Spec coverage:**
| Requirement | Task |
|---|---|
| Webcam auto-start, front camera on mobile | Task 1 verification + Task 6 |
| 468 landmark detection & mesh | Task 1 + Task 2 (iris) |
| Loading / error states | Task 1 + Task 3 |
| FPS counter | Task 1 |
| Toggle mesh, toggle points, mirror, screenshot | Task 1 |
| No-face feedback | Task 4 |
| Face proximity hint | Task 5 |
| Mobile camera flip | Task 6 |
| Production build | Task 7 |

**No placeholders:** all code blocks are complete and copy-paste ready.

**Type consistency:**
- `faceDetected: boolean` added to `UseFaceMeshReturn` in Task 4 and used in Task 4.
- `proximityLevel: "close" | "ok" | "far" | null` added in Task 5 and used in Task 5.
- `facingMode` parameter added to hook signature in Task 6 and passed from component in Task 6.
- `DrawFns.FACEMESH_IRISES` added in Task 2 — matches property name used in `drawFnsRef.current` assignment and `drawOneLandmarkSet`.
