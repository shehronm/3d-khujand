// Примеры для пробного расчёта: строятся кодом, чтобы человек мог попробовать без своего файла.
import { Shape, Path, ExtrudeGeometry, LatheGeometry, Vector2, Matrix4 } from 'three';

function toPositions(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  return new Float32Array(flat.attributes.position.array);
}

function gear() {
  const teeth = 20;
  const outer = 32;
  const root = 27;
  const shape = new Shape();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const phase = i % 4;
    const r = phase === 1 || phase === 2 ? outer : root;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Path();
  hole.absarc(0, 0, 5, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const window = new Path();
    window.absarc(Math.cos(a) * 16, Math.sin(a) * 16, 5, 0, Math.PI * 2, true);
    shape.holes.push(window);
  }
  return toPositions(new ExtrudeGeometry(shape, { depth: 10, bevelEnabled: false, curveSegments: 24 }));
}

function vase() {
  // Профиль стенки 2 мм: наружу вверх, по кромке, внутрь вниз до дна толщиной 2 мм.
  const outer = [[0, 0], [38, 0], [46, 28], [44, 70], [32, 118], [30, 140], [34, 150]];
  const inner = [[32, 150], [28, 140], [30, 118], [42, 70], [44, 28], [36, 2], [0, 2]];
  const points = [...outer, ...inner].map(([r, h]) => new Vector2(r, h));
  const geometry = new LatheGeometry(points, 96);
  geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
  return toPositions(geometry);
}

function stand() {
  // Подставка для телефона: боковой профиль, вытянутый на ширину 72 мм.
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(88, 0);
  s.lineTo(88, 6);
  s.lineTo(30, 6);
  s.lineTo(30, 16);
  s.lineTo(22, 16);
  s.lineTo(22, 8);
  s.lineTo(14, 8);
  s.lineTo(58, 104);
  s.lineTo(51, 107);
  s.lineTo(4, 8);
  s.lineTo(0, 8);
  s.closePath();
  const geometry = new ExtrudeGeometry(s, { depth: 72, bevelEnabled: false });
  geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
  return toPositions(geometry);
}

export const DEMOS = {
  gear: { label: 'Шестерня', file: 'shesternya-demo.stl', build: gear },
  vase: { label: 'Ваза', file: 'vaza-demo.stl', build: vase },
  stand: { label: 'Подставка для телефона', file: 'podstavka-demo.stl', build: stand }
};
