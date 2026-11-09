// Разбор файлов STL / 3MF / OBJ в один плоский массив треугольников.
// Используются официальные загрузчики three.js (MIT), без сервера: файл не покидает устройство клиента.
import { Matrix4, Group, Mesh } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export const ACCEPTED = ['stl', 'obj', '3mf'];

export function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(String(name));
  return match ? match[1].toLowerCase() : '';
}

export async function parseModel(name, buffer) {
  const ext = extensionOf(name);
  if (!ACCEPTED.includes(ext)) {
    throw new Error('Поддерживаются файлы STL, 3MF и OBJ. Для STEP сохраните модель в STL.');
  }
  if (ext === 'stl') {
    const geometry = new STLLoader().parse(buffer);
    return flatten(new Mesh(geometry), false);
  }
  if (ext === 'obj') {
    const text = new TextDecoder().decode(buffer);
    // OBJ обычно экспортируют с осью Y вверх — поворачиваем в систему принтера (Z вверх).
    return flatten(new OBJLoader().parse(text), true);
  }
  // 3MF-загрузчику нужен DOMParser, поэтому подключаем его только в браузере.
  const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
  return flatten(new ThreeMFLoader().parse(buffer), false);
}

function flatten(root, yUp) {
  const holder = new Group();
  holder.add(root);
  if (yUp) holder.rotation.x = Math.PI / 2;
  holder.updateMatrixWorld(true);

  const chunks = [];
  let length = 0;
  root.traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    let geometry = node.geometry.clone();
    if (geometry.index) geometry = geometry.toNonIndexed();
    geometry.applyMatrix4(new Matrix4().copy(node.matrixWorld));
    const array = geometry.attributes.position.array;
    chunks.push(array);
    length += array.length;
  });
  if (!length) throw new Error('В файле не нашлось ни одной детали.');

  const positions = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    positions.set(chunk, offset);
    offset += chunk.length;
  }
  return positions;
}
