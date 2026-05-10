/**
 * ARGlasses — wraps a Three.js scene that renders a loaded GLB model
 * positioned on facial landmarks supplied by MediaPipe Face Mesh.
 *
 * Usage pattern:
 *   const glasses = new ARGlasses();
 *   await glasses.loadFile(file);            // once, when user picks a file
 *   glasses.resize(videoW, videoH);          // match main canvas dimensions
 *   glasses.updatePose(landmarks);           // every frame in onResults
 *   glasses.render();                        // draws to internal canvas
 *   ctx.drawImage(glasses.canvas, 0, 0);    // composite onto main canvas
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Landmark = { x: number; y: number; z: number };

// MediaPipe Face Mesh landmark indices used for glasses placement
const LM = {
  LEFT_EYE_OUTER: 33,    // left outer corner  (video-space left  = screen right when not mirrored)
  RIGHT_EYE_OUTER: 263,  // right outer corner
  NOSE_BRIDGE: 168,       // glabella (between the eyes, top of nose)
  NOSE_TIP: 4,
} as const;

export class ARGlasses {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private model: THREE.Group | null = null;
  private loader = new GLTFLoader();
  private _width = 1280;
  private _height = 720;

  constructor() {
    // Transparent background so it can be composited on top of the video canvas
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(this._width, this._height);

    this.scene = new THREE.Scene();

    // Orthographic camera mapped to pixel coordinates
    // (0,0) = top-left, (width, height) = bottom-right
    this.camera = new THREE.OrthographicCamera(
      0, this._width,   // left, right
      0, this._height,  // top, bottom  (Y is flipped — 0=top in screen space)
      0.1, 2000
    );
    this.camera.position.z = 1000;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 2);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(0, -1, 2).normalize(); // light from viewer direction
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(1, 0, 1).normalize();
    this.scene.add(ambient, key, fill);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Resize the renderer to match the main canvas dimensions */
  resize(width: number, height: number) {
    if (this._width === width && this._height === height) return;
    this._width = width;
    this._height = height;
    this.renderer.setSize(width, height);
    this.camera.right = width;
    this.camera.bottom = height;
    this.camera.updateProjectionMatrix();
  }

  /** Load a GLB from a user-selected File object */
  loadFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    return this._load(url).finally(() => URL.revokeObjectURL(url));
  }

  /** Load a GLB from a URL (e.g. /sunglasses.glb in public/) */
  loadURL(url: string): Promise<void> {
    return this._load(url);
  }

  /**
   * Update the model pose from the current frame's landmarks.
   * Call this every frame inside fm.onResults().
   */
  updatePose(landmarks: Landmark[]) {
    if (!this.model) return;

    const lm = landmarks;
    const L = lm[LM.LEFT_EYE_OUTER];
    const R = lm[LM.RIGHT_EYE_OUTER];
    const N = lm[LM.NOSE_BRIDGE];

    if (!L || !R || !N) return;

    const W = this._width;
    const H = this._height;

    // Convert normalised landmark coords → pixel coords in the Three.js scene
    // Y is NOT negated here because the orthographic camera has Y=0 at top
    const lx = L.x * W;   const ly = L.y * H;
    const rx = R.x * W;   const ry = R.y * H;
    const nx = N.x * W;   const ny = N.y * H;

    // ── Position ──────────────────────────────────────────────────────────────
    // Place the model at the nose-bridge position
    const cx = nx;
    const cy = ny;
    // Z offset: bring model slightly in front of the face plane
    const cz = 500 + N.z * -300;

    // ── Scale ─────────────────────────────────────────────────────────────────
    // Inter-ocular distance in pixels → drives glasses width
    const ipd = Math.hypot(rx - lx, ry - ly);
    // model was normalised to ~1 unit wide at load time; target ≈ 1.6× IPD
    const scale = ipd * 1.6;

    // ── Rotation ──────────────────────────────────────────────────────────────
    // Roll — tilt of the eye line
    const roll = Math.atan2(ry - ly, rx - lx); // radians; positive = right side higher

    // Yaw — head turned left/right, estimated from z-depth asymmetry of eye corners
    // In MediaPipe, z is roughly proportional to depth (more negative = further from cam)
    // When head turns right (from viewer), the right eye's z should be more negative
    const zDiff = (R.z - L.z) * W;
    const yaw = Math.atan2(zDiff, ipd) * 1.2; // amplification factor

    // Pitch — head tilted forward/back
    // Estimate: how far the nose bridge is above/below the eye midpoint
    const eyeMidY = (ly + ry) / 2;
    const pitchRaw = (ny - eyeMidY) / (ipd * 0.8);
    const pitch = Math.atan(pitchRaw) * 0.6;

    // ── Apply ─────────────────────────────────────────────────────────────────
    this.model.position.set(cx, cy, cz);
    this.model.rotation.order = "YXZ";
    this.model.rotation.set(pitch, yaw, -roll);  // Euler YXZ
    this.model.scale.setScalar(scale);
  }

  /** Render the Three.js scene — call after updatePose() */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** The offscreen canvas; composite with ctx.drawImage(glasses.canvas, 0, 0) */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get hasModel() {
    return this.model !== null;
  }

  dispose() {
    this.model?.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry?.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    this.renderer.dispose();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _load(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          if (this.model) this.scene.remove(this.model);

          this.model = gltf.scene;

          // Normalise model so its longest axis = 1 unit,
          // then let updatePose() scale it to the correct pixel size
          const box = new THREE.Box3().setFromObject(this.model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          this.model.scale.divideScalar(maxDim);

          // Re-centre pivot to the bounding box centre
          const centre = new THREE.Vector3();
          box.getCenter(centre);
          this.model.position.sub(centre.divideScalar(maxDim));

          this.scene.add(this.model);
          resolve();
        },
        undefined,
        reject
      );
    });
  }
}
