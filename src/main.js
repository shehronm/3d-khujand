import './style.css';
import { STUDIO, BED, MATERIALS, QUALITIES, PRICING, LIMITS } from './config.js';
import { analyzeMesh, scaleAnalysis, fitsBed, guessUnits } from './geometry.js';
import { estimate, formatHours, formatGrams } from './pricing.js';
import { parseModel, ACCEPTED } from './loaders.js';
import { DEMOS } from './demo-models.js';
import { createViewer } from './viewer.js';
import { modelSummary, orderText, sendOrder, copyText, telegramUrl } from './order.js';

// DOM Elements
const canvas = document.getElementById('viewer');
const fileInput = document.getElementById('file-input');
const stage = document.getElementById('stage');
const dropHint = document.getElementById('drop-hint');
const fileNameEl = document.getElementById('file-name');
const fileStatusEl = document.getElementById('file-status');

const outSizeEl = document.getElementById('out-size');
const outVolumeEl = document.getElementById('out-volume');
const outFitEl = document.getElementById('out-fit');
const outWeightEl = document.getElementById('out-weight');
const outTimeEl = document.getElementById('out-time');
const outPriceEl = document.getElementById('out-price');

const unitsSelect = document.getElementById('units');
const scaleInput = document.getElementById('scale');
const infillInput = document.getElementById('infill');
const infillValueEl = document.getElementById('infill-value');
const quantityInput = document.getElementById('quantity');
const materialsChoiceEl = document.getElementById('materials-choice');
const colorsChoiceEl = document.getElementById('colors-choice');
const colorNameEl = document.getElementById('color-name');
const qualityChoiceEl = document.getElementById('quality-choice');

const orderOpenBtn = document.getElementById('order-open');
const orderDialog = document.getElementById('order-dialog');
const orderForm = document.getElementById('order-form');
const orderSummaryEl = document.getElementById('order-summary');
const orderCancelBtn = document.getElementById('order-cancel');
const orderStatusEl = document.getElementById('order-status');

const photoForm = document.getElementById('photo-form');
const photoInput = document.getElementById('photo-input');
const photoThumbsEl = document.getElementById('photo-thumbs');
const photoStatusEl = document.getElementById('photo-status');

// Initialize 3D Viewer
const viewer = createViewer(canvas, BED);

// State
let rawPositions = null;
let baseAnalysis = null;
let currentFileName = '';
let currentFileBlob = null;
let activeDemo = null;

const state = {
  material: 'PLA',
  colorId: 'graphite',
  quality: 'standard',
  infill: 20,
  quantity: 1,
  units: 1,
  scalePercent: 100
};

// Render Material choices
function renderMaterials() {
  materialsChoiceEl.innerHTML = '';
  for (const [key, mat] of Object.entries(MATERIALS)) {
    const label = document.createElement('label');
    label.className = 'choice-card';
    label.innerHTML = `
      <input type="radio" name="material" value="${key}" ${key === state.material ? 'checked' : ''}>
      <div class="choice-body">
        <div class="choice-title">${mat.label}</div>
        <div class="choice-desc">${mat.note}</div>
      </div>
    `;
    label.querySelector('input').addEventListener('change', () => {
      state.material = key;
      // Reset color to first available
      state.colorId = mat.colors[0].id;
      renderColors();
      updateViewerLook();
      calculate();
    });
    materialsChoiceEl.appendChild(label);
  }
}

// Render Colors for selected material
function renderColors() {
  colorsChoiceEl.innerHTML = '';
  const mat = MATERIALS[state.material];
  const activeColor = mat.colors.find(c => c.id === state.colorId) || mat.colors[0];
  state.colorId = activeColor.id;
  colorNameEl.textContent = activeColor.label;

  for (const col of mat.colors) {
    const label = document.createElement('label');
    label.className = 'swatch-label';
    label.title = col.label;
    label.innerHTML = `
      <input type="radio" name="color" value="${col.id}" ${col.id === state.colorId ? 'checked' : ''}>
      <span class="swatch" style="background-color: ${col.hex};"></span>
    `;
    label.querySelector('input').addEventListener('change', () => {
      state.colorId = col.id;
      colorNameEl.textContent = col.label;
      updateViewerLook();
    });
    colorsChoiceEl.appendChild(label);
  }
}

// Render Quality segmented control
function renderQuality() {
  qualityChoiceEl.innerHTML = '';
  for (const [key, q] of Object.entries(QUALITIES)) {
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="radio" name="quality" value="${key}" ${key === state.quality ? 'checked' : ''}>
      <span>${q.label} · ${q.layer} мм</span>
    `;
    label.querySelector('input').addEventListener('change', () => {
      state.quality = key;
      calculate();
    });
    qualityChoiceEl.appendChild(label);
  }
}

function updateViewerLook() {
  const mat = MATERIALS[state.material];
  const col = mat.colors.find(c => c.id === state.colorId) || mat.colors[0];
  viewer.setLook({
    hex: col.hex,
    roughness: mat.finish.roughness,
    metalness: mat.finish.metalness
  });
}

// Model Loading & Analysis
function setModelData(positions, name, blob = null) {
  rawPositions = positions;
  currentFileName = name;
  currentFileBlob = blob;
  fileNameEl.textContent = name;
  fileStatusEl.textContent = '';
  fileStatusEl.className = 'status';

  baseAnalysis = analyzeMesh(positions);
  viewer.setModel(positions);
  updateViewerLook();

  // Unit auto-detection hint
  const unitHint = guessUnits(baseAnalysis.size);
  if (unitHint === 'tiny' && state.units === 1) {
    fileStatusEl.textContent = 'Модель очень маленькая. Возможно, она сохранена в сантиметрах или дюймах?';
    fileStatusEl.className = 'status';
  } else if (unitHint === 'huge') {
    fileStatusEl.textContent = 'Модель очень большая. Проверьте масштаб.';
    fileStatusEl.className = 'status';
  }

  calculate();
}

function calculate() {
  if (!baseAnalysis) return;

  const totalScale = (state.scalePercent / 100) * state.units;
  const analysis = scaleAnalysis(baseAnalysis, totalScale);
  viewer.place(totalScale);

  const fits = fitsBed(analysis.size, BED);
  viewer.setFits(fits);

  // Update readouts
  const sz = analysis.size;
  outSizeEl.textContent = `${Math.round(sz.x)} × ${Math.round(sz.y)} × ${Math.round(sz.z)}`;
  outVolumeEl.textContent = `${(analysis.volumeMm3 / 1000).toFixed(1)} см³`;
  
  if (fits) {
    outFitEl.textContent = 'Помещается';
    outFitEl.style.color = 'var(--color-success)';
    orderOpenBtn.disabled = false;
  } else {
    outFitEl.textContent = 'Не помещается';
    outFitEl.style.color = 'var(--color-accent-offguard)';
  }

  const result = estimate(analysis, {
    material: state.material,
    quality: state.quality,
    infill: state.infill,
    quantity: state.quantity
  }, PRICING);

  outWeightEl.textContent = formatGrams(result.gramsTotal);
  outTimeEl.textContent = formatHours(result.hours);
  outPriceEl.textContent = `${result.total} ${PRICING.currency}`;

  // Store current result for ordering
  state.lastResult = result;
  state.lastAnalysis = analysis;
}

// Rotate handling
document.querySelectorAll('[data-rotate]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!rawPositions) return;
    const axis = btn.dataset.rotate;
    const rotated = viewer.rotate(axis);
    if (rotated) {
      rawPositions = rotated;
      baseAnalysis = analyzeMesh(rawPositions);
      calculate();
    }
  });
});

// Demo buttons
document.querySelectorAll('[data-demo]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.demo;
    loadDemo(key);
  });
});

function loadDemo(key) {
  const demo = DEMOS[key];
  if (!demo) return;
  activeDemo = key;

  document.querySelectorAll('[data-demo]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.demo === key));
  });

  const positions = demo.build();
  setModelData(positions, demo.label);
}

// File Upload Handlers
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await handleFile(file);
  fileInput.value = '';
});

async function handleFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ACCEPTED.includes(ext)) {
    fileStatusEl.textContent = 'Формат не поддерживается. Загрузите файл STL, 3MF или OBJ.';
    fileStatusEl.className = 'status error';
    return;
  }
  if (file.size > LIMITS.modelBytes) {
    fileStatusEl.textContent = 'Файл больше 50 МБ. Напишите нам в Telegram напрямую.';
    fileStatusEl.className = 'status error';
    return;
  }

  fileStatusEl.textContent = 'Загружаем и анализируем 3D-модель...';
  fileStatusEl.className = 'status';

  try {
    const buffer = await file.arrayBuffer();
    const positions = await parseModel(file.name, buffer);
    document.querySelectorAll('[data-demo]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    setModelData(positions, file.name, file);
    fileStatusEl.textContent = 'Модель успешно загружена';
    fileStatusEl.className = 'status success';
    setTimeout(() => {
      if (fileStatusEl.classList.contains('success')) fileStatusEl.textContent = '';
    }, 4000);
  } catch (err) {
    fileStatusEl.textContent = err.message || 'Не удалось открыть модель.';
    fileStatusEl.className = 'status error';
  }
}

// Drag & Drop
stage.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropHint.hidden = false;
});
stage.addEventListener('dragleave', (e) => {
  if (e.relatedTarget && stage.contains(e.relatedTarget)) return;
  dropHint.hidden = true;
});
stage.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropHint.hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (file) await handleFile(file);
});

// Settings Input Listeners
unitsSelect.addEventListener('change', () => {
  state.units = parseFloat(unitsSelect.value) || 1;
  calculate();
});

scaleInput.addEventListener('input', () => {
  state.scalePercent = Math.max(5, Math.min(1000, parseFloat(scaleInput.value) || 100));
  calculate();
});

infillInput.addEventListener('input', () => {
  state.infill = parseInt(infillInput.value, 10);
  infillValueEl.textContent = `${state.infill}%`;
  calculate();
});

quantityInput.addEventListener('input', () => {
  state.quantity = Math.max(1, Math.min(100, parseInt(quantityInput.value, 10) || 1));
  calculate();
});

// Order Dialog
orderOpenBtn.addEventListener('click', () => {
  if (!state.lastResult || !state.lastAnalysis) return;
  const mat = MATERIALS[state.material];
  const col = mat.colors.find(c => c.id === state.colorId) || mat.colors[0];

  const summary = modelSummary({
    fileName: currentFileName,
    analysis: state.lastAnalysis,
    options: {
      material: state.material,
      quality: state.quality,
      infill: state.infill,
      scale: (state.scalePercent / 100) * state.units
    },
    result: state.lastResult,
    colorLabel: col.label
  });

  orderSummaryEl.textContent = summary;
  orderStatusEl.textContent = '';
  orderStatusEl.className = 'status';
  orderDialog.showModal();
});

orderCancelBtn.addEventListener('click', () => {
  orderDialog.close();
});

orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const contact = orderForm.contact.value.trim();
  if (!contact) {
    orderStatusEl.textContent = 'Укажите контакт для связи';
    orderStatusEl.className = 'status error';
    return;
  }

  orderStatusEl.textContent = 'Отправка заявки...';
  orderStatusEl.className = 'status';

  const formData = new FormData(orderForm);
  formData.append('kind', 'model');
  formData.append('text', orderSummaryEl.textContent);
  if (currentFileBlob) {
    formData.append('model', currentFileBlob, currentFileName);
  }

  const res = await sendOrder(formData);

  if (res.ok) {
    orderStatusEl.textContent = 'Заявка отправлена! Мастер свяжется с вами в Telegram.';
    orderStatusEl.className = 'status success';
    setTimeout(() => orderDialog.close(), 2500);
  } else if (res.fallback) {
    // Fallback: Copy to clipboard and open Telegram direct chat
    const fullText = orderText('model', orderSummaryEl.textContent, {
      name: orderForm.name.value,
      contact,
      delivery: orderForm.delivery.value,
      comment: orderForm.comment.value
    });
    await copyText(fullText);
    orderStatusEl.textContent = 'Расчёт скопирован. Переходим в Telegram...';
    orderStatusEl.className = 'status success';
    setTimeout(() => {
      window.open(telegramUrl, '_blank', 'noopener');
      orderDialog.close();
    }, 1200);
  } else {
    orderStatusEl.textContent = res.message || 'Ошибка отправки.';
    orderStatusEl.className = 'status error';
  }
});

// Photo Order Form
let photoFiles = [];
photoInput.addEventListener('change', () => {
  const files = Array.from(photoInput.files || []).slice(0, LIMITS.photoCount);
  photoFiles = files;
  renderPhotoThumbs();
});

function renderPhotoThumbs() {
  photoThumbsEl.innerHTML = '';
  for (const f of photoFiles) {
    const li = document.createElement('li');
    li.className = 'thumb-item';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.alt = f.name;
    li.appendChild(img);
    photoThumbsEl.appendChild(li);
  }
}

photoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const contact = photoForm.contact.value.trim();
  if (!contact) {
    photoStatusEl.textContent = 'Укажите телефон или Telegram';
    photoStatusEl.className = 'status error';
    return;
  }
  if (!photoFiles.length) {
    photoStatusEl.textContent = 'Прикрепите хотя бы одно фото';
    photoStatusEl.className = 'status error';
    return;
  }

  photoStatusEl.textContent = 'Отправка фото...';
  photoStatusEl.className = 'status';

  const formData = new FormData(photoForm);
  formData.append('kind', 'photo');
  formData.append('text', `Заявка по фото:\n${photoForm.comment.value || 'Без описания'}\nКонтакт: ${contact}`);

  const res = await sendOrder(formData);

  if (res.ok) {
    photoStatusEl.textContent = 'Фото отправлены! Мастер скоро ответит.';
    photoStatusEl.className = 'status success';
    photoForm.reset();
    photoFiles = [];
    renderPhotoThumbs();
  } else if (res.fallback) {
    const fullText = orderText('photo', photoForm.comment.value, { contact });
    await copyText(fullText);
    photoStatusEl.textContent = 'Текст заявки скопирован. Отправьте фото в Telegram мастеру...';
    photoStatusEl.className = 'status success';
    setTimeout(() => {
      window.open(telegramUrl, '_blank', 'noopener');
    }, 1500);
  } else {
    photoStatusEl.textContent = res.message || 'Ошибка отправки';
    photoStatusEl.className = 'status error';
  }
});

// Init
renderMaterials();
renderColors();
renderQuality();
loadDemo('gear');
