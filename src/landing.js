import './style.css';
import './squares-runtime.js';
import './hero-copy.js';
import './hero-phone.js';
import './hero-grid.js';
import './page-rules.js';

// --- 1. Interactive Catalog Solutions Search ---
const searchInput = document.getElementById('catalog-search');
const catalogList = document.getElementById('catalog-list');

if (searchInput && catalogList) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const items = catalogList.querySelectorAll('li');
    items.forEach(li => {
      const text = (li.getAttribute('data-name') || '') + ' ' + li.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        li.style.display = 'flex';
      } else {
        li.style.display = 'none';
      }
    });
  });
}

// --- 2. Interactive Materials Laboratory Tabs ---
const matTabs = document.querySelectorAll('.mat-tab');
const activeMatTitle = document.getElementById('active-mat-title');
const activeMatTemp = document.getElementById('active-mat-temp');
const activeMatDesc = document.getElementById('active-mat-desc');
const activeMatColors = document.getElementById('active-mat-colors');

const MATERIAL_INFO = {
  PLA: {
    title: 'PLA (Биоразлагаемый полимер)',
    temp: 'до 55 °C',
    desc: 'Жёсткий и экологичный полимер с микронной детализацией. Идеален для органайзеров, подставок, ночников-литофаний и точных макетов.',
    colors: [
      { hex: '#26262B', name: 'Чёрный' },
      { hex: '#FFFFFF', name: 'Белый' },
      { hex: '#3275FF', name: 'Синий' },
      { hex: '#FC7343', name: 'Оранжевый' }
    ]
  },
  PETG: {
    title: 'PETG (Конструкционный пластик)',
    temp: 'до 75 °C',
    desc: 'Ударопрочный термостойкий пластик, устойчивый к маслам, бензину и влаге. Лучший выбор для авто-креплений, шестерней и деталей механизмов.',
    colors: [
      { hex: '#1C1F24', name: 'Чёрный' },
      { hex: '#B9D7E6', name: 'Полупрозрачный' },
      { hex: '#8A939E', name: 'Серый' }
    ]
  },
  TPU: {
    title: 'TPU Flex (Эластичный полиуретан)',
    temp: 'до 60 °C',
    desc: 'Резиноподобный эластомер с высокой прочностью на разрыв. Гнётся в любые стороны без излома. Применяется для бамперов, демпферов и уплотнителей.',
    colors: [
      { hex: '#1C1F24', name: 'Чёрный' },
      { hex: '#FFFFFF', name: 'Белый' }
    ]
  },
  Silk: {
    title: 'Silk Gold (Декоративный шёлк)',
    temp: 'до 50 °C',
    desc: 'Специальный композит с глянцевым металлическим отливом. Создаёт эффект литого золота или бронзы без видимых линий слоёв. Идеален для наград и подарков.',
    colors: [
      { hex: '#E5A93C', name: 'Золотой' },
      { hex: '#C0C0C0', name: 'Серебряный' },
      { hex: '#B87333', name: 'Медный' }
    ]
  }
};

matTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    matTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const matKey = tab.getAttribute('data-mat');
    const data = MATERIAL_INFO[matKey];
    if (data && activeMatTitle && activeMatTemp && activeMatDesc && activeMatColors) {
      activeMatTitle.textContent = data.title;
      activeMatTemp.textContent = data.temp;
      activeMatDesc.textContent = data.desc;
      activeMatColors.innerHTML = data.colors.map(c =>
        `<span class="color-dot" style="background:${c.hex};" title="${c.name}"></span>`
      ).join('');
    }
  });
});

// --- 3. Photo Order Form with Telegram Export ---
const orderForm = document.getElementById('landing-order-form');
if (orderForm) {
  orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('order-desc')?.value || '';
    const mat = document.getElementById('order-material')?.value || 'PETG';
    const qty = document.getElementById('order-quantity')?.value || '1';
    const phone = document.getElementById('order-phone')?.value || '';
    const city = document.getElementById('order-city')?.value || 'Худжанд';

    const text = [
      `👋 Здравствуйте, 3D KHUJAND!`,
      `Хочу оформить заказ:`,
      `📦 Деталь: ${desc}`,
      `🧵 Материал: ${mat}`,
      `🔢 Количество: ${qty} шт.`,
      `📍 Город: ${city}`,
      `📞 Контакт: ${phone}`
    ].join('\n');

    const tgUrl = `https://t.me/khujand3d?text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  });
}

// --- 4. FAQ Accordion ---
const faqTriggers = document.querySelectorAll('.faq-trigger');
faqTriggers.forEach(btn => {
  btn.addEventListener('click', () => {
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    const content = btn.nextElementSibling;
    const icon = btn.querySelector('.faq-icon');

    // Close all other FAQs
    faqTriggers.forEach(otherBtn => {
      if (otherBtn !== btn) {
        otherBtn.setAttribute('aria-expanded', 'false');
        if (otherBtn.nextElementSibling) {
          otherBtn.nextElementSibling.classList.add('hidden');
        }
        const otherIcon = otherBtn.querySelector('.faq-icon');
        if (otherIcon) otherIcon.textContent = '+';
      }
    });

    // Toggle current
    btn.setAttribute('aria-expanded', String(!isExpanded));
    if (content) {
      content.classList.toggle('hidden', isExpanded);
    }
    if (icon) {
      icon.textContent = isExpanded ? '+' : '−';
    }
  });
});
