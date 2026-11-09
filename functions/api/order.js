// Cloudflare Pages Function: POST /api/order
// Принимает заявку с сайта и пересылает её в Telegram. Токен бота хранится только здесь,
// в переменных окружения Cloudflare (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID), и в браузер не попадает.

const MODEL_EXT = ['stl', '3mf', 'obj'];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MODEL_MAX = 50 * 1024 * 1024; // предел Bot API для отправки файла
const PHOTO_MAX = 10 * 1024 * 1024;
const PHOTO_COUNT = 5;
const TEXT_MAX = 3500; // сообщение Telegram — до 4096 символов

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({ error: 'Отправка заявок ещё не настроена.' }, 503);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Не удалось прочитать заявку.' }, 400);
  }

  // Ловушка для ботов: настоящий посетитель это поле не видит и не заполняет.
  if (String(form.get('website') || '').trim()) return json({ ok: true });

  const kind = form.get('kind') === 'photo' ? 'photo' : 'model';
  const contact = clean(form.get('contact'), 120);
  const text = clean(form.get('text'), TEXT_MAX);
  if (!contact) return json({ error: 'Укажите телефон или Telegram для связи.' }, 400);
  if (!text) return json({ error: 'Пустая заявка.' }, 400);

  const model = form.get('model');
  const photos = form.getAll('photos').filter(isFile);

  if (kind === 'model') {
    if (isFile(model)) {
      const ext = (/\.([a-z0-9]+)$/i.exec(model.name) || [])[1]?.toLowerCase();
      if (!MODEL_EXT.includes(ext)) return json({ error: 'Файл модели должен быть STL, 3MF или OBJ.' }, 400);
      if (model.size > MODEL_MAX) return json({ error: 'Файл больше 50 МБ — отправьте его в Telegram напрямую.' }, 413);
    }
  } else {
    if (!photos.length) return json({ error: 'Прикрепите хотя бы одно фото.' }, 400);
    if (photos.length > PHOTO_COUNT) return json({ error: `Не больше ${PHOTO_COUNT} фото.` }, 400);
    for (const photo of photos) {
      if (!PHOTO_TYPES.includes(photo.type)) return json({ error: 'Фото должны быть JPG, PNG, WebP или HEIC.' }, 400);
      if (photo.size > PHOTO_MAX) return json({ error: 'Каждое фото — до 10 МБ.' }, 413);
    }
  }

  const api = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const chat = env.TELEGRAM_CHAT_ID;

  try {
    await call(api + '/sendMessage', jsonBody({ chat_id: chat, text, disable_web_page_preview: true }));
    const files = kind === 'model' ? (isFile(model) ? [model] : []) : photos;
    for (const file of files) {
      const body = new FormData();
      body.append('chat_id', chat);
      body.append('document', file, safeName(file.name));
      await call(api + '/sendDocument', { method: 'POST', body });
    }
  } catch {
    return json({ error: 'Telegram не принял заявку. Напишите нам напрямую.' }, 502);
  }

  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Метод не поддерживается.' }, 405);
}

async function call(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error('Telegram ' + response.status);
  return response;
}

function jsonBody(data) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function isFile(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function' && value.size > 0;
}

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function safeName(name) {
  return String(name || 'file').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120);
}
