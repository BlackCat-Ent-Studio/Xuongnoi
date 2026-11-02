import * as THREE from 'three';

/** Mask layer: only the highlighted figures are on it, so a mask pass sees nothing else. */
const MASK_LAYER = 6;
/** The mask is drawn this much smaller than the canvas: cheap on phones and the edge glow is soft anyway. */
const MASK_SCALE = 0.75;
/** The glow breathes this long, then holds steady. */
export const PULSE_SECONDS = 4;
const PULSE_HZ = 1.6;
const SETTLED = 0.55;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/**
 * Edge glow from a silhouette mask. Taps on three rings around the pixel find "how close is the figure":
 * the near rings give a bright core line, the far ring a soft halo. Pixels just inside the figure's edge glow
 * too, so the line hugs the silhouette on both sides. The figure's own colours are never touched.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D uMask;
uniform vec2 uTexel;
uniform float uStrength;
varying vec2 vUv;
const vec2 DIRS[8] = vec2[8](vec2(1.0, 0.0), vec2(0.7071, 0.7071), vec2(0.0, 1.0), vec2(-0.7071, 0.7071), vec2(-1.0, 0.0), vec2(-0.7071, -0.7071), vec2(0.0, -1.0), vec2(0.7071, -0.7071));
void main() {
  float m0 = texture2D(uMask, vUv).r;
  float near = 0.0;
  float inner = 1.0;
  float far = 0.0;
  float spread = 0.85 + 0.3 * uStrength;
  for (int i = 0; i < 8; i++) {
    vec2 d = DIRS[i] * uTexel;
    float a = texture2D(uMask, vUv + d * 1.5).r;
    float b = texture2D(uMask, vUv + d * 2.8).r;
    float c = texture2D(uMask, vUv + d * 7.5 * spread).r;
    near = max(near, max(a, b));
    inner = min(inner, a);
    far += c;
  }
  far /= 8.0;
  float outside = 1.0 - m0;
  float core = outside * near + m0 * (1.0 - inner);
  float halo = outside * (1.0 - near) * clamp(far * 3.0, 0.0, 1.0) * 0.9;
  float a = clamp(core, 0.0, 1.0) * (0.75 + 0.25 * uStrength) + halo * (0.6 + 0.4 * uStrength);
  vec3 coreColor = vec3(1.0, 1.0, 0.82);
  vec3 haloColor = vec3(1.0, 0.7, 0.0);
  float coreShare = clamp(core * 1.4, 0.0, 1.0);
  vec3 col = mix(haloColor, coreColor, coreShare);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= a;
  gl_FragColor.a = a;
}`;

/**
 * "This one" outline: a bright glowing edge that follows the silhouette of the chosen figures, drawn over everything
 * (an object behind a wall or a crate stack is still found). Two cheap passes only while something is chosen:
 * the chosen figures as a white mask into a half-size target, then a full-screen edge shader blended over the finished frame.
 * It never takes clicks and never touches the objects' own materials.
 */
export class ObjectHighlight {
  private targets: THREE.Object3D[] = [];
  private strength = 1;
  private mask: THREE.WebGLRenderTarget | null = null;
  private readonly maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false });
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quadMaterial = new THREE.ShaderMaterial({
    uniforms: { uMask: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uStrength: { value: 1 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  private readonly quad: THREE.Mesh;

  constructor() {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Chooses the figures to outline (empty = none). `strength` 0..1 is the pulse (1 = brightest). */
  sync(roots: readonly THREE.Object3D[], strength: number): void {
    for (const o of this.targets) o.traverse((n) => n.layers.disable(MASK_LAYER));
    this.targets = [...roots];
    for (const o of this.targets) o.traverse((n) => n.layers.enable(MASK_LAYER));
    this.strength = strength;
  }

  /** Number of figures currently outlined (for tests and checks). */
  get shown(): number {
    return this.targets.length;
  }

  /** Draws the outline over the frame the renderer just finished. Does nothing when no figure is chosen. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.targets.length === 0) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, Math.round(size.x * MASK_SCALE));
    const h = Math.max(2, Math.round(size.y * MASK_SCALE));
    if (!this.mask) this.mask = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    else if (this.mask.width !== w || this.mask.height !== h) this.mask.setSize(w, h);

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevShadow = renderer.shadowMap.autoUpdate;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevBackground = scene.background;
    const prevFog = scene.fog;
    const prevOverride = scene.overrideMaterial;
    const prevLayers = camera.layers.mask;
    try {
      scene.background = null;
      scene.fog = null;
      scene.overrideMaterial = this.maskMaterial;
      camera.layers.set(MASK_LAYER);
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.mask);
      renderer.render(scene, camera);
    } finally {
      scene.background = prevBackground;
      scene.fog = prevFog;
      scene.overrideMaterial = prevOverride;
      camera.layers.mask = prevLayers;
      renderer.shadowMap.autoUpdate = prevShadow;
      renderer.setClearColor(prevClear, prevAlpha);
    }
    this.quadMaterial.uniforms.uMask!.value = this.mask.texture;
    (this.quadMaterial.uniforms.uTexel!.value as THREE.Vector2).set(1 / w, 1 / h);
    this.quadMaterial.uniforms.uStrength!.value = this.strength;
    try {
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.render(this.quadScene, this.quadCamera);
    } finally {
      renderer.autoClear = prevAutoClear;
      renderer.setRenderTarget(prevTarget);
    }
  }

  dispose(): void {
    this.sync([], 1);
    this.mask?.dispose();
    this.mask = null;
    this.maskMaterial.dispose();
    this.quadMaterial.dispose();
    this.quad.geometry.dispose();
  }
}

/** Pulse strength 0.3..1 `seconds` after the highlight was set: breathes for a while, then holds at a calmer level. */
export function pulseStrength(seconds: number): number {
  if (seconds >= PULSE_SECONDS) return SETTLED;
  return 0.65 + 0.35 * Math.sin(seconds * Math.PI * 2 * PULSE_HZ - Math.PI / 2);
}
