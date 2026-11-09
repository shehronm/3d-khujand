// Чистая геометрия без DOM: работает в браузере и в тестах Node.
// positions — плоский массив треугольников (x,y,z × 3 вершины на треугольник), единицы — мм.

export function analyzeMesh(positions) {
  if (!positions || positions.length < 9 || positions.length % 9 !== 0) {
    throw new Error('В файле нет треугольников — это не 3D-модель.');
  }
  let signed = 0;
  let area = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];

    // Объём тетраэдра от начала координат до треугольника (со знаком).
    signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    // Площадь треугольника = половина модуля векторного произведения рёбер.
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;

    if (ax < minX) minX = ax; if (bx < minX) minX = bx; if (cx < minX) minX = cx;
    if (ay < minY) minY = ay; if (by < minY) minY = by; if (cy < minY) minY = cy;
    if (az < minZ) minZ = az; if (bz < minZ) minZ = bz; if (cz < minZ) minZ = cz;
    if (ax > maxX) maxX = ax; if (bx > maxX) maxX = bx; if (cx > maxX) maxX = cx;
    if (ay > maxY) maxY = ay; if (by > maxY) maxY = by; if (cy > maxY) maxY = cy;
    if (az > maxZ) maxZ = az; if (bz > maxZ) maxZ = bz; if (cz > maxZ) maxZ = cz;
  }

  const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  const volume = Math.abs(signed);
  // Грубая проверка замкнутости: у открытой поверхности объём почти нулевой относительно габаритов.
  const boxVolume = size.x * size.y * size.z;
  const closed = boxVolume > 0 && volume / boxVolume > 0.001;

  return {
    triangles: positions.length / 9,
    volumeMm3: volume,
    areaMm2: area,
    size,
    min: { x: minX, y: minY, z: minZ },
    closed
  };
}

// Пересчёт результатов анализа при равномерном масштабировании без повторного прохода по треугольникам.
export function scaleAnalysis(analysis, factor) {
  return {
    ...analysis,
    volumeMm3: analysis.volumeMm3 * factor ** 3,
    areaMm2: analysis.areaMm2 * factor ** 2,
    size: { x: analysis.size.x * factor, y: analysis.size.y * factor, z: analysis.size.z * factor },
    min: { x: analysis.min.x * factor, y: analysis.min.y * factor, z: analysis.min.z * factor }
  };
}

export function fitsBed(size, bed) {
  // Модель можно повернуть вокруг вертикали, поэтому сравниваем отсортированные габариты по X/Y.
  const [a, b] = [size.x, size.y].sort((p, q) => q - p);
  const [bedA, bedB] = [bed.x, bed.y].sort((p, q) => q - p);
  return a <= bedA && b <= bedB && size.z <= bed.z;
}

// Подсказка по единицам: STL не хранит единицы, поэтому крошечная модель скорее всего в см или дюймах.
export function guessUnits(size) {
  const largest = Math.max(size.x, size.y, size.z);
  if (largest > 0 && largest < 4) return 'tiny';
  if (largest > 2000) return 'huge';
  return 'ok';
}
