// 3D-сцена: стол принтера, модель, свет и камера. Ось Z смотрит вверх, как в слайсерах.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, BufferGeometry,
  Float32BufferAttribute, HemisphereLight, DirectionalLight, LineSegments, LineBasicMaterial,
  PlaneGeometry, ShadowMaterial, Vector3, Box3, Sphere, Color, SRGBColorSpace, PCFSoftShadowMap,
  Matrix4, Shape, ShapeGeometry, MeshBasicMaterial
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const TOKENS = {
  plate: '#131B24',
  gridMinor: '#1C2733',
  gridMajor: '#26445E',
  edge: '#0287DE',
  warn: '#FC7343'
};

export function createViewer(canvas, bed) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 1, 5000);
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 40;
  controls.maxDistance = 1500;

  scene.add(new HemisphereLight('#dbe8ff', '#0b1117', 1.1));
  const key = new DirectionalLight('#ffffff', 2.2);
  key.position.set(220, -260, 420);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 1200 });
  scene.add(key);
  const rim = new DirectionalLight('#9fd3ff', 0.8);
  rim.position.set(-300, 260, 200);
  scene.add(rim);

  const plate = buildPlate(bed);
  scene.add(plate.group);

  const holder = new Group();
  scene.add(holder);
  const material = new MeshStandardMaterial({ color: '#2B2F36', roughness: 0.6, metalness: 0 });
  let mesh = null;
  let autoSpin = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  controls.addEventListener('start', () => { autoSpin = false; });

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);

  function frame() {
    if (autoSpin && mesh && !reducedMotion.matches) holder.rotation.z += 0.0035;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function setModel(positions) {
    if (mesh) {
      holder.remove(mesh);
      mesh.geometry.dispose();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    holder.add(mesh);
    holder.rotation.z = 0;
    autoSpin = true;
  }

  // Масштаб и центрирование: модель стоит на столе (Z = 0) и находится в его центре.
  function place(scale) {
    if (!mesh) return;
    mesh.scale.setScalar(scale);
    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld(true);
    const box = new Box3().setFromObject(mesh);
    const center = box.getCenter(new Vector3());
    mesh.position.set(-center.x, -center.y, -box.min.z);
    frameCamera();
  }

  function frameCamera() {
    const box = new Box3().setFromObject(holder);
    const sphere = box.isEmpty() ? new Sphere(new Vector3(0, 0, 0), bed.x / 2) : box.getBoundingSphere(new Sphere());
    const radius = Math.max(sphere.radius, 45);
    const distance = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.15;
    const dir = new Vector3(0.62, -0.95, 0.62).normalize();
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(dir, distance);
    camera.near = Math.max(0.5, distance / 100);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function rotate(axis) {
    if (!mesh) return;
    const turn = new Matrix4();
    if (axis === 'x') turn.makeRotationX(Math.PI / 2);
    else if (axis === 'y') turn.makeRotationY(Math.PI / 2);
    else turn.makeRotationZ(Math.PI / 2);
    mesh.geometry.applyMatrix4(turn);
    mesh.geometry.computeVertexNormals();
    return mesh.geometry.attributes.position.array;
  }

  function setLook({ hex, roughness, metalness }) {
    material.color = new Color(hex);
    material.roughness = roughness;
    material.metalness = metalness;
  }

  function setFits(fits) {
    plate.edge.material.color = new Color(fits ? TOKENS.edge : TOKENS.warn);
  }

  resize();
  frameCamera();
  requestAnimationFrame(frame);

  return { setModel, place, rotate, setLook, setFits, frameCamera };
}

function buildPlate(bed) {
  const group = new Group();
  const hx = bed.x / 2;
  const hy = bed.y / 2;

  const r = 8;
  const outline = new Shape();
  outline.moveTo(-hx + r, -hy);
  outline.lineTo(hx - r, -hy);
  outline.quadraticCurveTo(hx, -hy, hx, -hy + r);
  outline.lineTo(hx, hy - r);
  outline.quadraticCurveTo(hx, hy, hx - r, hy);
  outline.lineTo(-hx + r, hy);
  outline.quadraticCurveTo(-hx, hy, -hx, hy - r);
  outline.lineTo(-hx, -hy + r);
  outline.quadraticCurveTo(-hx, -hy, -hx + r, -hy);
  const base = new Mesh(new ShapeGeometry(outline), new MeshBasicMaterial({ color: TOKENS.plate }));
  base.position.z = -0.6;
  group.add(base);

  const shadow = new Mesh(new PlaneGeometry(bed.x, bed.y), new ShadowMaterial({ opacity: 0.35 }));
  shadow.position.z = -0.2;
  shadow.receiveShadow = true;
  group.add(shadow);

  const minor = [];
  const major = [];
  for (let x = -hx; x <= hx + 0.01; x += 8) {
    const list = Math.abs(x % 64) < 0.01 ? major : minor;
    list.push(x, -hy, -0.4, x, hy, -0.4);
  }
  for (let y = -hy; y <= hy + 0.01; y += 8) {
    const list = Math.abs(y % 64) < 0.01 ? major : minor;
    list.push(-hx, y, -0.4, hx, y, -0.4);
  }
  group.add(lines(minor, TOKENS.gridMinor), lines(major, TOKENS.gridMajor));

  const pts = outline.getPoints(6);
  const edgeArr = [];
  for (let i = 0; i < pts.length - 1; i++) {
    edgeArr.push(pts[i].x, pts[i].y, -0.3, pts[i + 1].x, pts[i + 1].y, -0.3);
  }
  const edge = lines(edgeArr, TOKENS.edge);
  group.add(edge);
  return { group, edge };
}

function lines(array, color) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(array, 3));
  return new LineSegments(geometry, new LineBasicMaterial({ color }));
}
