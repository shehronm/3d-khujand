import './style.css';
import { LIMITS } from './config.js';
import { orderText, sendOrder, copyText, telegramUrl } from './order.js';

// Photo order handling on landing page
const photoForm = document.getElementById('landing-photo-form');
const photoInput = document.getElementById('landing-photo-input');
const photoThumbsEl = document.getElementById('landing-photo-thumbs');
const photoStatusEl = document.getElementById('landing-photo-status');

let photoFiles = [];

if (photoInput && photoThumbsEl) {
  photoInput.addEventListener('change', () => {
    const files = Array.from(photoInput.files || []).slice(0, LIMITS.photoCount);
    photoFiles = files;
    renderPhotoThumbs();
  });
}

function renderPhotoThumbs() {
  if (!photoThumbsEl) return;
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

if (photoForm) {
  photoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = photoForm.contact.value.trim();
    if (!contact) {
      if (photoStatusEl) {
        photoStatusEl.textContent = 'Укажите телефон или Telegram';
        photoStatusEl.className = 'status error';
      }
      return;
    }
    if (!photoFiles.length) {
      if (photoStatusEl) {
        photoStatusEl.textContent = 'Прикрепите хотя бы одно фото';
        photoStatusEl.className = 'status error';
      }
      return;
    }

    if (photoStatusEl) {
      photoStatusEl.textContent = 'Отправка фото...';
      photoStatusEl.className = 'status';
    }

    const formData = new FormData(photoForm);
    formData.append('kind', 'photo');
    formData.append('text', `Заявка по фото с сайта 3D KHUJAND:\n${photoForm.comment.value || 'Без описания'}\nКонтакт: ${contact}`);

    const res = await sendOrder(formData);

    if (res.ok) {
      if (photoStatusEl) {
        photoStatusEl.textContent = 'Фото отправлены! Мастер скоро ответит в Telegram.';
        photoStatusEl.className = 'status success';
      }
      photoForm.reset();
      photoFiles = [];
      renderPhotoThumbs();
    } else if (res.fallback) {
      const fullText = orderText('photo', photoForm.comment.value, { contact });
      await copyText(fullText);
      if (photoStatusEl) {
        photoStatusEl.textContent = 'Текст заявки скопирован. Отправьте фото в Telegram мастеру...';
        photoStatusEl.className = 'status success';
      }
      setTimeout(() => {
        window.open(telegramUrl, '_blank', 'noopener');
      }, 1500);
    } else {
      if (photoStatusEl) {
        photoStatusEl.textContent = res.message || 'Ошибка отправки';
        photoStatusEl.className = 'status error';
      }
    }
  });
}
