import './style.css';
import { LIMITS, MATERIALS } from './config.js';
import { orderText, sendOrder, copyText, telegramUrl } from './order.js';

// 1. Lithophane Interactive Lamp Simulator
const lampStage = document.getElementById('lamp-stage');
const lithoToggle = document.getElementById('litho-toggle');
const lithoBtnText = document.getElementById('litho-btn-text');
const lithoCard = document.getElementById('litho-card');

function toggleLamp() {
  if (!lampStage) return;
  const isOn = lampStage.classList.toggle('light-on');
  if (lithoToggle) {
    lithoToggle.setAttribute('aria-pressed', String(isOn));
  }
  if (lithoBtnText) {
    lithoBtnText.textContent = isOn ? 'Выключить' : 'Включить свет';
  }
}

if (lampStage) lampStage.addEventListener('click', toggleLamp);
if (lithoToggle) lithoToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleLamp();
});

// 2. Interactive Material Lab Tabs
const matTabs = document.querySelectorAll('.mat-tab');
const matInfoText = document.getElementById('mat-info-text');
const matColorsPreview = document.getElementById('mat-colors-preview');
const activeMatSpec = document.getElementById('active-mat-spec');

const MAT_DATA = {
  PLA: {
    spec: 'PLA · до 55 °C',
    text: '<b>PLA:</b> Высокоточный и жёсткий полимер. Идеален для настольных органайзеров, подставок под технику, декора и макетов. Не пахнет, имеет богатую палитру.',
    colors: [
      { hex: '#2B2F36', name: 'Графит' },
      { hex: '#E9ECEF', name: 'Белый' },
      { hex: '#FC7343', name: 'Оранжевый' },
      { hex: '#0287DE', name: 'Синий' }
    ]
  },
  PETG: {
    spec: 'PETG · до 75 °C',
    text: '<b>PETG:</b> Конструкционный ударопрочный пластик. Не боится влаги, падений и ультрафиолета. Лучший выбор для авто-креплений, шестерней и деталей техники.',
    colors: [
      { hex: '#1C1F24', name: 'Чёрный' },
      { hex: '#B9D7E6', name: 'Прозрачный' },
      { hex: '#8A939E', name: 'Серый' }
    ]
  },
  TPU: {
    spec: 'TPU · до 60 °C',
    text: '<b>TPU (Гибкий):</b> Резиноподобный эластомер. Гнётся в любые стороны без излома. Отлично подходит для защитных бамперов, амортизаторов, ножек приборов и уплотнителей.',
    colors: [
      { hex: '#1C1F24', name: 'Чёрный' },
      { hex: '#E9ECEF', name: 'Белый' }
    ]
  },
  SILK: {
    spec: 'Silk PLA · до 55 °C',
    text: '<b>Silk Gold & Silver:</b> Премиальный шёлковый полимер с глубоким металлическим блеском. Роскошно смотрится на интерьерных вазах, статуэтках и наградных подарках.',
    colors: [
      { hex: '#D4A640', name: 'Золото' },
      { hex: '#B8BEC6', name: 'Серебро' },
      { hex: '#B8693F', name: 'Медь' }
    ]
  }
};

matTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    matTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const key = tab.dataset.mat;
    const data = MAT_DATA[key];
    if (!data) return;

    if (activeMatSpec) activeMatSpec.textContent = data.spec;
    if (matInfoText) matInfoText.innerHTML = data.text;
    if (matColorsPreview) {
      matColorsPreview.innerHTML = data.colors.map(c => 
        `<span class="color-dot" style="background:${c.hex};" title="${c.name}"></span>`
      ).join('');
    }
  });
});

// 3. Drop teaser redirect
const dropTeaser = document.getElementById('calc-preview-drop');
if (dropTeaser) {
  dropTeaser.addEventListener('click', () => {
    window.location.href = '/calculator.html';
  });
  dropTeaser.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropTeaser.style.borderColor = 'var(--color-accent-offguard)';
  });
  dropTeaser.addEventListener('dragleave', () => {
    dropTeaser.style.borderColor = '';
  });
  dropTeaser.addEventListener('drop', (e) => {
    e.preventDefault();
    window.location.href = '/calculator.html';
  });
}

// 4. Photo Order Handling on Landing Page
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
        photoStatusEl.textContent = 'Текст заявки скопирован. Переходим в Telegram...';
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

// 5. Interactive Catalog Search & Category Filter (Access Grid Style)
const catalogSearchInput = document.getElementById('catalog-search-input');
const catalogSearchClear = document.getElementById('catalog-search-clear');
const filterChips = document.querySelectorAll('.tag-chip');
const catalogCards = document.querySelectorAll('#catalog-grid .feature-card');
const catalogEmptyMsg = document.getElementById('catalog-no-results');

let activeCategory = 'all';
let searchQuery = '';

function filterCatalog() {
  let visibleCount = 0;
  const q = searchQuery.toLowerCase().trim();

  catalogCards.forEach(card => {
    const cat = card.dataset.category || '';
    const keywords = (card.dataset.keywords || '').toLowerCase();
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const desc = card.querySelector('p')?.textContent.toLowerCase() || '';

    const matchesCat = (activeCategory === 'all' || cat === activeCategory);
    const matchesSearch = !q || keywords.includes(q) || title.includes(q) || desc.includes(q);

    if (matchesCat && matchesSearch) {
      card.style.display = '';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  if (catalogEmptyMsg) {
    catalogEmptyMsg.hidden = (visibleCount > 0);
  }
}

if (catalogSearchInput) {
  catalogSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (catalogSearchClear) {
      catalogSearchClear.hidden = !searchQuery;
    }
    filterCatalog();
  });
}

if (catalogSearchClear) {
  catalogSearchClear.addEventListener('click', () => {
    if (catalogSearchInput) catalogSearchInput.value = '';
    searchQuery = '';
    catalogSearchClear.hidden = true;
    filterCatalog();
    if (catalogSearchInput) catalogSearchInput.focus();
  });
}

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.filter || 'all';
    filterCatalog();
  });
});
