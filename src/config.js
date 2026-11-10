// Все цены и параметры студии в одном месте. Меняйте значения здесь — сайт пересчитает всё сам.
// Цены стартовые: сверьте их со своей себестоимостью перед запуском.

export const STUDIO = {
  name: '3D KHUJAND',
  city: 'Худжанд',
  // Аккаунт Telegram, куда клиент пишет напрямую (личный или рабочий, не канал).
  telegramContact: 'khujand3d',
  telegramChannel: 'khujand3d',
  instagram: '3d_khujand'
};

// Рабочая область стола принтера, мм (Bambu Lab A1 / P1S / X1C — 256 × 256 × 256).
export const BED = { x: 256, y: 256, z: 256 };

export const PRICING = {
  currency: 'сом.',
  setupFee: 20, // подготовка файла и запуск печати, за заказ
  hourRate: 6, // работа принтера, за час
  minOrder: 30, // минимальная сумма заказа
  roundTo: 5, // итог округляется вверх до этого шага
  wasteFactor: 1.05 // кайма, продувка, мелкие потери пластика
};

export const MATERIALS = {
  PLA: {
    label: 'PLA',
    note: 'Декор, макеты, подставки',
    density: 1.24,
    pricePerGram: 0.6,
    speedFactor: 1,
    finish: { roughness: 0.62, metalness: 0 },
    colors: [
      { id: 'graphite', label: 'Графит', hex: '#2B2F36' },
      { id: 'white', label: 'Белый', hex: '#E9ECEF' },
      { id: 'orange', label: 'Оранжевый', hex: '#FC7343' },
      { id: 'blue', label: 'Синий', hex: '#0287DE' }
    ]
  },
  PETG: {
    label: 'PETG',
    note: 'Прочные и ударостойкие детали',
    density: 1.27,
    pricePerGram: 0.7,
    speedFactor: 0.85,
    finish: { roughness: 0.35, metalness: 0 },
    colors: [
      { id: 'black', label: 'Чёрный', hex: '#1C1F24' },
      { id: 'clear', label: 'Прозрачный', hex: '#B9D7E6' },
      { id: 'grey', label: 'Серый', hex: '#8A939E' }
    ]
  },
  TPU: {
    label: 'TPU',
    note: 'Гибкие: чехлы, ножки, уплотнители',
    density: 1.21,
    pricePerGram: 1,
    speedFactor: 0.45,
    finish: { roughness: 0.8, metalness: 0 },
    colors: [
      { id: 'black', label: 'Чёрный', hex: '#1C1F24' },
      { id: 'white', label: 'Белый', hex: '#E9ECEF' }
    ]
  },
  SILK: {
    label: 'Silk PLA',
    note: 'Шёлковый блеск для подарков и ваз',
    density: 1.24,
    pricePerGram: 0.8,
    speedFactor: 0.9,
    finish: { roughness: 0.28, metalness: 0.45 },
    colors: [
      { id: 'gold', label: 'Золото', hex: '#D4A640' },
      { id: 'silver', label: 'Серебро', hex: '#B8BEC6' },
      { id: 'copper', label: 'Медь', hex: '#B8693F' }
    ]
  },
  CARBON: {
    label: 'Carbon PA-CF',
    note: 'Углеволокно, замена металлу до 150°C',
    density: 1.34,
    pricePerGram: 1.4,
    speedFactor: 0.7,
    finish: { roughness: 0.88, metalness: 0.1 },
    colors: [
      { id: 'carbon-black', label: 'Matte Carbon', hex: '#22252B' },
      { id: 'carbon-grey', label: 'Темно-серый', hex: '#3B4048' }
    ]
  }
};

// Скорость печати в граммах в час для каждого качества (для PLA; другие материалы умножаются на speedFactor).
export const QUALITIES = {
  draft: { label: 'Черновое', layer: 0.28, gramsPerHour: 22 },
  standard: { label: 'Стандарт', layer: 0.2, gramsPerHour: 15 },
  fine: { label: 'Детальное', layer: 0.12, gramsPerHour: 8 }
};

export const LIMITS = {
  modelBytes: 50 * 1024 * 1024, // Telegram-бот отправляет файлы до 50 МБ
  photoBytes: 10 * 1024 * 1024,
  photoCount: 5,
  quantityMax: 100
};
