import { MATERIALS, QUALITIES, PRICING } from './config.js';

// Толщина «оболочки» (стенки + верх/низ), см. Внутренний объём печатается с заполнением.
const SHELL_CM = 0.09;
const WARMUP_HOURS = 10 / 60;
const SECONDS_PER_LAYER_MIN = 4;

export function estimate(analysis, options, pricing = PRICING) {
  const material = MATERIALS[options.material];
  const quality = QUALITIES[options.quality];
  if (!material) throw new Error('Неизвестный материал: ' + options.material);
  if (!quality) throw new Error('Неизвестное качество: ' + options.quality);

  const infill = clamp(Number(options.infill), 5, 100) / 100;
  const quantity = Math.round(clamp(Number(options.quantity) || 1, 1, 1000));

  const volumeCm3 = analysis.volumeMm3 / 1000;
  const areaCm2 = analysis.areaMm2 / 100;
  const shell = Math.min(volumeCm3, areaCm2 * SHELL_CM);
  const core = Math.max(0, volumeCm3 - shell);
  const printedCm3 = shell + core * infill;
  const grams = printedCm3 * material.density * pricing.wasteFactor;

  const byWeight = grams / (quality.gramsPerHour * material.speedFactor);
  const layers = Math.ceil(analysis.size.z / quality.layer);
  const byLayers = (layers * SECONDS_PER_LAYER_MIN) / 3600;
  const hoursEach = Math.max(byWeight, byLayers);
  const hours = hoursEach * quantity + WARMUP_HOURS;

  const raw = pricing.setupFee + quantity * (grams * material.pricePerGram + hoursEach * pricing.hourRate);
  const total = Math.max(pricing.minOrder, Math.ceil(raw / pricing.roundTo) * pricing.roundTo);

  return {
    gramsEach: grams,
    gramsTotal: grams * quantity,
    hours,
    layers,
    quantity,
    total
  };
}

export function formatHours(hours) {
  const minutes = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return m + ' мин';
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatGrams(grams) {
  return grams >= 1000 ? (grams / 1000).toFixed(2).replace('.', ',') + ' кг' : Math.round(grams) + ' г';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
