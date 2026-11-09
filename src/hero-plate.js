import { createViewer } from './viewer.js';
import { DEMOS } from './demo-models.js';

(function () {
  const device = document.querySelector('.hero__device');
  const canvas = document.getElementById('hero-3d-canvas');
  if (!device || !canvas) return;

  const MODEL_META = {
    gear: { specs: '38 г • ~1ч 45м • PLA', scale: 1.55 },
    vase: { specs: '64 г • ~3ч 10м • PETG', scale: 0.88 },
    stand: { specs: '52 г • ~2ч 30м • PLA', scale: 1.1 }
  };

  let viewer = null;
  let currentModel = 'gear';
  let currentColor = '#2B2F36';

  try {
    viewer = createViewer(canvas, { x: 256, y: 256 });
    loadModel('gear');
  } catch (err) {
    console.error('Failed to initialize 3D viewer on hero plate:', err);
  }

  function loadModel(name) {
    if (!viewer || !DEMOS[name]) return;
    currentModel = name;
    const positions = DEMOS[name].build();
    viewer.setModel(positions);
    const meta = MODEL_META[name] || { scale: 1, specs: 'PLA 0.12 мм' };
    viewer.place(meta.scale);
    updateColor(currentColor);

    const specsEl = document.getElementById('hero-model-specs');
    if (specsEl) specsEl.textContent = meta.specs;
  }

  function updateColor(hex) {
    if (!viewer) return;
    currentColor = hex;
    const isSilver = hex === '#8E929E' || hex === '#9499A8';
    viewer.setLook({
      hex: hex,
      roughness: isSilver ? 0.35 : 0.52,
      metalness: isSilver ? 0.45 : 0.04
    });
  }

  // Model Switcher Tabs
  const modelTabs = document.getElementById('hero-model-tabs');
  if (modelTabs) {
    modelTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.hero-model-btn');
      if (!btn) return;
      const model = btn.getAttribute('data-model');
      if (model && DEMOS[model]) {
        modelTabs.querySelectorAll('.hero-model-btn').forEach(b => {
          b.classList.remove('active', 'bg-white', 'text-ag-gray-950', 'shadow-sm');
          b.classList.add('text-ag-gray-600');
        });
        btn.classList.add('active', 'bg-white', 'text-ag-gray-950', 'shadow-sm');
        btn.classList.remove('text-ag-gray-600');
        loadModel(model);
      }
    });
  }

  // Color Picker
  const colorPicker = document.getElementById('hero-color-picker');
  if (colorPicker) {
    colorPicker.addEventListener('click', (e) => {
      const btn = e.target.closest('.hero-color-btn');
      if (!btn) return;
      const color = btn.getAttribute('data-color');
      if (color) {
        colorPicker.querySelectorAll('.hero-color-btn').forEach(b => {
          b.classList.remove('ring-2', 'ring-brand-500', 'scale-110');
          b.classList.add('ring-1', 'ring-black/10');
        });
        btn.classList.remove('ring-1', 'ring-black/10');
        btn.classList.add('ring-2', 'ring-brand-500', 'scale-110');
        updateColor(color);
      }
    });
  }

  // Entrance animation for plate card
  const card = device.querySelector('.plate-card');
  if (card) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduce.matches) {
      card.animate([
        { opacity: 0, transform: 'translateY(28px) scale(0.97)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0px) scale(1)', filter: 'blur(0px)' }
      ], {
        delay: 300,
        duration: 900,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'backwards'
      });
    }
  }

  // Backward compatibility hook for hero-grid timing
  window.AGPhone = {
    tapIn: function () { return 850; }
  };
})();
