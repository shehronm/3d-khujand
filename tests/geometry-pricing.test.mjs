import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMesh, scaleAnalysis, fitsBed, guessUnits } from '../src/geometry.js';
import { estimate, formatHours, formatGrams } from '../src/pricing.js';

// Helper: build a cube with dimensions dx, dy, dz (12 triangles, 36 vertices, 108 floats)
function makeBox(dx, dy, dz) {
  const p = [
    // Front (+Z)
    [0, 0, dz], [dx, 0, dz], [dx, dy, dz],
    [0, 0, dz], [dx, dy, dz], [0, dy, dz],
    // Back (-Z)
    [0, 0, 0], [dx, dy, 0], [dx, 0, 0],
    [0, 0, 0], [0, dy, 0], [dx, dy, 0],
    // Right (+X)
    [dx, 0, 0], [dx, dy, 0], [dx, dy, dz],
    [dx, 0, 0], [dx, dy, dz], [dx, 0, dz],
    // Left (-X)
    [0, 0, 0], [0, dy, dz], [0, dy, 0],
    [0, 0, 0], [0, 0, dz], [0, dy, dz],
    // Top (+Y)
    [0, dy, 0], [dx, dy, dz], [dx, dy, 0],
    [0, dy, 0], [0, dy, dz], [dx, dy, dz],
    // Bottom (-Y)
    [0, 0, 0], [dx, 0, 0], [dx, 0, dz],
    [0, 0, 0], [dx, 0, dz], [0, 0, dz]
  ];
  return new Float32Array(p.flat());
}

describe('Geometry Engine', () => {
  it('correctly calculates volume, area, and bounding box of a 10x20x30 mm box', () => {
    const box = makeBox(10, 20, 30);
    const analysis = analyzeMesh(box);

    assert.equal(analysis.triangles, 12);
    // Expected volume: 10 * 20 * 30 = 6000 mm³
    assert.ok(Math.abs(analysis.volumeMm3 - 6000) < 0.1, `Volume was ${analysis.volumeMm3}, expected 6000`);
    // Expected area: 2 * (10*20 + 20*30 + 10*30) = 2 * (200 + 600 + 300) = 2200 mm²
    assert.ok(Math.abs(analysis.areaMm2 - 2200) < 0.1, `Area was ${analysis.areaMm2}, expected 2200`);
    assert.deepEqual(analysis.size, { x: 10, y: 20, z: 30 });
    assert.equal(analysis.closed, true);
  });

  it('correctly scales analysis metrics without re-traversing geometry', () => {
    const box = makeBox(10, 10, 10);
    const base = analyzeMesh(box);
    const scaled = scaleAnalysis(base, 2);

    assert.ok(Math.abs(scaled.volumeMm3 - 8000) < 0.1);
    assert.ok(Math.abs(scaled.areaMm2 - 2400) < 0.1);
    assert.deepEqual(scaled.size, { x: 20, y: 20, z: 20 });
  });

  it('detects bed fit properly with 256x256x256 bed', () => {
    const bed = { x: 256, y: 256, z: 256 };
    assert.equal(fitsBed({ x: 200, y: 200, z: 200 }, bed), true);
    assert.equal(fitsBed({ x: 256, y: 200, z: 100 }, bed), true);
    assert.equal(fitsBed({ x: 300, y: 100, z: 100 }, bed), false);
    assert.equal(fitsBed({ x: 100, y: 100, z: 260 }, bed), false);
  });

  it('flags scale anomalies for units detection', () => {
    assert.equal(guessUnits({ x: 2, y: 1, z: 3 }), 'tiny');
    assert.equal(guessUnits({ x: 2500, y: 50, z: 50 }), 'huge');
    assert.equal(guessUnits({ x: 100, y: 80, z: 50 }), 'ok');
  });

  it('rejects invalid or empty mesh arrays', () => {
    assert.throws(() => analyzeMesh(null));
    assert.throws(() => analyzeMesh(new Float32Array([1, 2, 3])));
  });
});

describe('Pricing & Estimation Engine', () => {
  it('calculates realistic weight, time, and price for a standard print', () => {
    const box = makeBox(40, 40, 40); // 64 cm³
    const analysis = analyzeMesh(box);

    const result = estimate(analysis, {
      material: 'PLA',
      quality: 'standard',
      infill: 20,
      quantity: 1
    });

    assert.ok(result.gramsEach > 10 && result.gramsEach < 60, `Grams was ${result.gramsEach}`);
    assert.ok(result.hours > 0.5 && result.hours < 6, `Hours was ${result.hours}`);
    assert.ok(result.total >= 30, `Total was ${result.total}, must meet minOrder 30`);
    assert.equal(result.total % 5, 0, 'Price must be rounded to nearest 5');
  });

  it('formats hours and grams properly in Russian', () => {
    assert.equal(formatHours(0.5), '30 мин');
    assert.equal(formatHours(1.5), '1 ч 30 мин');
    assert.equal(formatHours(2.0), '2 ч');
    assert.equal(formatGrams(45.2), '45 г');
    assert.equal(formatGrams(1250), '1,25 кг');
  });
});
