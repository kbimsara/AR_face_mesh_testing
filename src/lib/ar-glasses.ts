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
  NOSE_BRIDGE: 168, // glabella  — glasses rest here (between eyebrows / top of nose)
  NOSE_TIP:    1,   // tip of nose — used to derive face "down" direction
} as const;

// Reusable temp vectors so the per-frame hot path allocates nothing
const _vX  = new THREE.Vector3();
const _vY  = new THREE.Vector3();
const _vZ  = new THREE.Vector3();
const _vD  = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _q   = new THREE.Quaternion();

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
   *
   * Strategy: build an orthonormal face basis from three anchor points and
   * orient the glasses with a single rotation matrix.
   *
   *   X axis = right ear-line  (left iris  → right iris)
   *   Y axis = down           (eye-mid    → nose-tip,  re-orthogonalised)
   *   Z axis = forward        (out of face, X × downVec)
   *
   * The pivot is then translated to the glabella (landmark 168) — the spot
   * where real glasses physically rest — and pushed slightly forward along
   * the face normal so the bridge of the frame doesn't clip into the head.
   * Call once per frame inside fm.onResults(), before render().
   */
  updatePose(landmarks: Lm[]) {
    if (!this._loaded) return;

    const L  = landmarks[IDX.L_IRIS] ?? landmarks[IDX.L_EYE_OUT];
    const R  = landmarks[IDX.R_IRIS] ?? landmarks[IDX.R_EYE_OUT];
    const NB = landmarks[IDX.NOSE_BRIDGE];
    const NT = landmarks[IDX.NOSE_TIP];
    if (!L || !R || !NB || !NT) return;

    // ── Lift to pixel space (z stays in MediaPipe's normalised units, scaled
    //    by W so it lives on the same magnitude as x). This pseudo-3D space
    //    is what we render the glasses in. ────────────────────────────────
    const W = this.W, H = this.H;
    const lx = L.x  * W, ly = L.y  * H, lz = L.z  * W;
    const rx = R.x  * W, ry = R.y  * H, rz = R.z  * W;
    const bx = NB.x * W, by = NB.y * H, bz = NB.z * W;
    const tx = NT.x * W, ty = NT.y * H, tz = NT.z * W;

    const ipd = Math.hypot(rx - lx, ry - ly);
    if (ipd < 5) return;

    // ── Build orthonormal face basis ─────────────────────────────────────
    // X: along the eye-line (left iris → right iris)
    _vX.set(rx - lx, ry - ly, rz - lz).normalize();
    // Down vector candidate: from eye midpoint to nose tip
    const emx = (lx + rx) * 0.5, emy = (ly + ry) * 0.5, emz = (lz + rz) * 0.5;
    _vD.set(tx - emx, ty - emy, tz - emz).normalize();
    // Z (forward, out of face) = X × downVec
    _vZ.crossVectors(_vX, _vD).normalize();
    // Re-orthogonalise Y against X & Z: face's true "down"
    _vY.crossVectors(_vZ, _vX).normalize();

    // ── Rotation: model's local axes → face basis ─────────────────────────
    // Three.js default model orientation: +X right, +Y up, +Z toward camera.
    // Our scene's Y is flipped (orthographic with top=0, bottom=H), so
    // "face up" in scene-space is -faceDown.
    _mat.makeBasis(
      _vX,
      _vY.clone().multiplyScalar(-1),  // flip down → up
      _vZ,
    );
    _q.setFromRotationMatrix(_mat);

    // ── Position: anchor on glabella, nudge along face normal ─────────────
    // Forward push so the bridge doesn't intersect the face mesh
    const fwd = ipd * 0.15;
    const cx = bx + _vZ.x * fwd;
    const cy = by + _vZ.y * fwd;
    // Scene Z stays in the orthographic frustum; preserve depth ordering
    const cz = 4000 + NB.z * -600;

    // ── Scale ─────────────────────────────────────────────────────────────
    // Wayfarer frame width ≈ 2.3× IPD
    const scale = ipd * 2.3;

    // ── Apply ─────────────────────────────────────────────────────────────
    this.pivot.position.set(cx, cy, cz);
    this.pivot.quaternion.copy(_q);
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
