// Заявка: текст для мастера и отправка через серверную функцию /api/order.
// Если функция ещё не подключена, заявка копируется, и клиент отправляет её в Telegram сам.
import { STUDIO, MATERIALS, QUALITIES, PRICING } from './config.js';
import { formatGrams, formatHours } from './pricing.js';

export function modelSummary(state) {
  const { fileName, analysis, options, result, colorLabel } = state;
  const s = analysis.size;
  return [
    'Расчёт по модели',
    `Файл: ${fileName}`,
    `Размер: ${round(s.x)} × ${round(s.y)} × ${round(s.z)} мм (масштаб ${Math.round(options.scale * 100)}%)`,
    `Материал: ${MATERIALS[options.material].label}, цвет: ${colorLabel}`,
    `Качество: ${QUALITIES[options.quality].label} (${QUALITIES[options.quality].layer} мм), заполнение ${options.infill}%`,
    `Количество: ${result.quantity} шт.`,
    `Вес: ${formatGrams(result.gramsTotal)}, время печати: ${formatHours(result.hours)}`,
    `Предварительная цена: ${result.total} ${PRICING.currency}`
  ].join('\n');
}

export function orderText(kind, summary, contact) {
  const lines = [kind === 'photo' ? 'Заявка без 3D-модели (по фото)' : 'Заявка на 3D-печать'];
  if (summary) lines.push('', summary);
  lines.push('', `Имя: ${contact.name || '—'}`, `Связь: ${contact.contact}`);
  if (contact.delivery) lines.push(`Получение: ${contact.delivery}`);
  if (contact.comment) lines.push(`Комментарий: ${contact.comment}`);
  return lines.join('\n');
}

export async function sendOrder(formData) {
  let response;
  try {
    response = await fetch('/api/order', { method: 'POST', body: formData });
  } catch {
    return { ok: false, fallback: true };
  }
  if (response.ok) return { ok: true };
  // 404/405 — функция не развёрнута (локальный просмотр), 503 — не задан токен бота.
  if ([404, 405, 501, 503].includes(response.status)) return { ok: false, fallback: true };
  let message = 'Не удалось отправить заявку. Попробуйте ещё раз.';
  try {
    const data = await response.json();
    if (data?.error) message = data.error;
  } catch {}
  return { ok: false, fallback: false, message };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const telegramUrl = `https://t.me/${STUDIO.telegramContact}`;

function round(value) {
  return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
}
