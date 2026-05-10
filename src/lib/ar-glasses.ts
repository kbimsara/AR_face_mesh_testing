/**
 * ARGlasses — Three.js overlay that positions a loaded GLB model on
 * MediaPipe Face Mesh landmarks.
 *
 * Key design decisions:
 *  - Orthographic camera in pixel space (0,0 top-left; W,H bottom-right)
 *  - "pivot" Group receives pose; inner "mesh" Group holds the normalised GLB
 *  - Iris landmarks (468/473) are used when available for sub-pixel accuracy
 *  - The renderer canvas is composited onto the main 2D canvas each frame
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Lm = { x: number; y: number; z: number };

// MediaPipe Face Mesh landmark indices
const IDX = {
  L_IRIS:    468,   // left  iris centre  (refineLandmarks: true)
  R_IRIS:    473,   // right iris centre
  L_EYE_OUT:  33,   // left  eye outer corner (fallback)
  R_EYE_OUT: 263,   // right eye outer corner
  NOSE_BRIDGE: 168, // glabella
} as const;

export class ARGlasses {
  readonly renderer: THREE.WebGLRenderer;
  private scene    = new THREE.Scene();
  private camera   : THREE.OrthographicCamera;
  private pivot    = new THREE.Group();   // receives position / rotation / scale
  private inner    = new THREE.Group();   // holds the pre-centred GLB mesh
  private loader   = new GLTFLoader();
  private _loaded  = false;
  private W = 1280;
  private H = 720;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,   // required for ctx.drawImage() readback
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(this.W, this.H);
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping     = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    // ── Orthographic camera in screen-pixel space ────────────────────────────
    // left=0, right=W → X increases rightward  (like canvas)
    // top=0, bottom=H → Y increases downward  (like canvas; flip vs GL default)
    this.camera = new THREE.OrthographicCamera(0, this.W, 0, this.H, 1, 10000);
    this.camera.position.z = 5000;

    // ── Environment for PBR / metallic materials ─────────────────────────────
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    pmrem.dispose();

    // ── Lighting ──────────────────────────────────────────────────────────────
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(200, -300, 800);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-400, 0, 400);
    this.scene.add(key, fill);

    // ── Scene graph ───────────────────────────────────────────────────────────
    this.pivot.add(this.inner);
    this.scene.add(this.pivot);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  resize(w: number, h: number) {
    if (this.W === w && this.H === h) return;
    this.W = w; this.H = h;
    this.renderer.setSize(w, h);
    this.camera.right  = w;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }

  loadFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    return this._load(url).finally(() => URL.revokeObjectURL(url));
  }

  loadURL(url: string): Promise<void> {
    return this._load(url);
  }

  /**
   * Update 3-D pose from the current frame's MediaPipe landmarks.
   * Call once per frame inside fm.onResults(), before render().
   */
  updatePose(landmarks: Lm[]) {
    if (!this._loaded) return;

    // Best anchor = iris centres (available when refineLandmarks: true)
    const L = landmarks[IDX.L_IRIS] ?? landmarks[IDX.L_EYE_OUT];
    const R = landmarks[IDX.R_IRIS] ?? landmarks[IDX.R_EYE_OUT];
    const N = landmarks[IDX.NOSE_BRIDGE];
    if (!L || !R || !N) return;

    // ── Pixel coordinates ─────────────────────────────────────────────────────
    const lx = L.x * this.W,  ly = L.y * this.H;
    const rx = R.x * this.W,  ry = R.y * this.H;

    // IPD in pixels
    const ipd = Math.hypot(rx - lx, ry - ly);
    if (ipd < 5) return; // face too small / not tracked

    // ── Position ──────────────────────────────────────────────────────────────
    // Glasses centre = midpoint of the two iris positions
    // Shift down slightly so the frame sits over the eyes, not above them
    const cx = (lx + rx) / 2;
    const cy = (ly + ry) / 2 + ipd * 0.55;
    // Z: bring glasses in front of face; MediaPipe z is negative-toward-camera
    const cz = 4000 + N.z * -600;

    // ── Scale ─────────────────────────────────────────────────────────────────
    // Wayfarer frame width ≈ 2.3× inter-pupillary distance
    const scale = ipd * 2.3;

    // ── Rotation ──────────────────────────────────────────────────────────────
    // Roll — in-plane tilt of the eye line
    const roll = Math.atan2(ry - ly, rx - lx);

    // Yaw — left/right head turn from Z-depth asymmetry
    const yaw = Math.atan2((R.z - L.z) * this.W, ipd) * 1.6;

    // Pitch — forward/back head tilt
    const ny = N.y * this.H;
    const pitch = Math.atan2(ny - cy, ipd) * 0.5;

    // ── Apply ─────────────────────────────────────────────────────────────────
    this.pivot.position.set(cx, cy, cz);
    this.pivot.rotation.order = "YXZ";
    this.pivot.rotation.set(pitch, yaw, -roll);
    this.pivot.scale.setScalar(scale);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get canvas()    { return this.renderer.domElement; }
  get hasModel()  { return this._loaded; }

  dispose() {
    this.scene.clear();
    this.renderer.dispose();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _load(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          // Remove any previously loaded model from inner group
          while (this.inner.children.length) {
            this.inner.remove(this.inner.children[0]);
          }

          const model = gltf.scene;

          // Fix materials: ensure double-sided rendering and correct transparency
          model.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            mats.forEach((m: THREE.Material) => {
              m.side = THREE.DoubleSide;
              // Improve lens / glass materials
              const std = m as THREE.MeshStandardMaterial;
              if (std.transparent || std.opacity < 1) {
                std.depthWrite = false;
                std.alphaTest  = 0.01;
              }
              // Boost metalness/roughness visibility under simple lighting
              if ("metalness" in std) std.envMapIntensity = 1.5;
            });
          });

          // ── Normalise to unit size ──────────────────────────────────────────
          // Compute bounding box of the raw model (before any transform)
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;

          // Scale model so longest axis = 1 unit
          model.scale.setScalar(1 / maxDim);

          // Centre model at inner group origin
          // After scaling, the centre is at centre_world / maxDim
          const centre = new THREE.Vector3();
          box.getCenter(centre);
          model.position.set(
            -centre.x / maxDim,
            -centre.y / maxDim,
            -centre.z / maxDim
          );

          this.inner.add(model);
          this._loaded = true;
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }
}
