// script.js
// Popolnoma brez knjižnic. Deluje na mobilnih (Android Chrome, iOS Safari) in namiznih brskalnikih.
// Funkcije: kamera (selfie privzeto), overlay PNG, fotografiranje 1080x1920 (9:16), shranjevanje + iOS fallback,
// ter emoji “nalepke” (dodaj, premikaj, velikost, rotacija, brisanje).

/* -------------------- DOM -------------------- */
const stage = document.getElementById('stage');
const video = document.getElementById('video');
const overlayImg = document.getElementById('overlay');
const stickersLayer = document.getElementById('stickersLayer');
const statusEl = document.getElementById('status');

const btnShot = document.getElementById('btnShot');
const btnFlip = document.getElementById('btnFlip');

const emojiBar = document.getElementById('emojiBar');
const btnCustomEmoji = document.getElementById('btnCustomEmoji');
const btnClearStickers = document.getElementById('btnClearStickers');

const editor = document.getElementById('editor');
const sizeSlider = document.getElementById('sizeSlider');
const rotSlider = document.getElementById('rotSlider');
const btnDeleteSticker = document.getElementById('btnDeleteSticker');
const btnBringFront = document.getElementById('btnBringFront');
const btnDoneEdit = document.getElementById('btnDoneEdit');

const modal = document.getElementById('modal');
const resultImg = document.getElementById('resultImg');
const downloadLink = document.getElementById('downloadLink');
const btnShare = document.getElementById('btnShare');
const btnCloseModal = document.getElementById('btnCloseModal');

/* -------------------- Kamera -------------------- */
let stream = null;
let facingMode = 'user'; // privzeto selfie
let isMirrored = true;   // video je zrcaljen pri user (CSS transform)

async function startCamera() {
  setStatus('Zaganjam kamero…');

  // Ustavimo star stream (če obstaja)
  stopCamera();

  // Poskusimo z ideal facingMode; nekateri brskalniki zahtevajo drugačne kombinacije
  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e1) {
    // Fallback: brez width/height
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facingMode }
      });
    } catch (e2) {
      // Zadnji fallback: brez facingMode (vsaj da kamera dela)
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      facingMode = 'user';
    }
  }

  video.srcObject = stream;

  // iOS: počakamo na metadata, da dobimo videoWidth/videoHeight
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();

  // Zrcaljenje samo pri selfie
  isMirrored = (facingMode === 'user');
  video.style.transform = isMirrored ? 'scaleX(-1)' : 'none';

  setStatus('Kamera pripravljena ✅', 1200);
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

btnFlip.addEventListener('click', async () => {
  facingMode = (facingMode === 'user') ? 'environment' : 'user';
  await startCamera();
});

/* -------------------- Status helper -------------------- */
let statusTimer = null;
function setStatus(msg, autoHideMs = 0) {
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  clearTimeout(statusTimer);
  if (autoHideMs > 0) {
    statusTimer = setTimeout(() => {
      statusEl.style.display = 'none';
    }, autoHideMs);
  }
}

/* -------------------- Emoji nalepke -------------------- */
/**
 * Nalepke hranimo kot “normalizirane” koordinate glede na oder:
 * x, y: 0..1 (relativno)
 * size: px (relativno na oder; pri renderju v DOM in na canvas skaliramo)
 * rot: stopinje
 * z: vrstni red
 */
let stickers = [];
let selectedId = null;
let nextId = 1;

// Predlagani emojiji (taki, ki jih želiš)
const defaultEmojis = [
  "🚜", "🌸", "🐴", "🐄", "🧪", "🔬", "🧬", "🍎", "🥛",
  "🧁", "🎂", "🥩", "🎓", "📚", "🪴", "🍅"
];

function buildEmojiBar() {
  emojiBar.innerHTML = '';
  defaultEmojis.forEach(emo => {
    const b = document.createElement('button');
    b.className = 'emoji-btn';
    b.type = 'button';
    b.textContent = emo;
    b.title = `Dodaj ${emo}`;
    b.addEventListener('click', () => addSticker(emo));
    emojiBar.appendChild(b);
  });
}

function addSticker(emoji) {
  const id = String(nextId++);
  const s = {
    id,
    emoji,
    x: 0.5,
    y: 0.55,
    size: 96, // osnovno
    rot: 0,
    z: stickers.length ? Math.max(...stickers.map(a => a.z)) + 1 : 1
  };
  stickers.push(s);
  renderStickers();
  selectSticker(id);
}

function clearStickers() {
  stickers = [];
  selectedId = null;
  renderStickers();
  hideEditor();
}

btnClearStickers.addEventListener('click', clearStickers);

btnCustomEmoji.addEventListener('click', () => {
  const val = prompt("Vpiši emoji (npr. 🐝 ali 👩‍🌾). Lahko tudi več znakov, a najbolje 1 emoji:");
  if (!val) return;
  addSticker(val.trim());
});

// Render nalepk v DOM layer (za predogled in vlečenje)
function renderStickers() {
  stickersLayer.innerHTML = '';

  // sort po z
  const sorted = [...stickers].sort((a,b) => a.z - b.z);

  sorted.forEach(s => {
    const el = document.createElement('div');
    el.className = 'sticker' + (s.id === selectedId ? ' selected' : '');
    el.dataset.id = s.id;
    el.textContent = s.emoji;

    const { w, h } = stageSize();
    const px = s.x * w;
    const py = s.y * h;

    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.fontSize = `${s.size}px`;
    el.style.transform = `translate(-50%,-50%) rotate(${s.rot}deg)`;

    // klik/tap za izbiro
    el.addEventListener('pointerdown', (ev) => onStickerPointerDown(ev, s.id));

    stickersLayer.appendChild(el);
  });
}

function stageSize() {
  const r = stage.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

function getSticker(id) {
  return stickers.find(s => s.id === id) || null;
}

function selectSticker(id) {
  selectedId = id;
  renderStickers();
  showEditorFor(id);
}

function showEditorFor(id) {
  const s = getSticker(id);
  if (!s) return hideEditor();
  editor.hidden = false;
  sizeSlider.value = String(Math.round(s.size));
  rotSlider.value = String(Math.round(s.rot));
}

function hideEditor() {
  editor.hidden = true;
}

btnDoneEdit.addEventListener('click', () => {
  selectedId = null;
  renderStickers();
  hideEditor();
});

btnDeleteSticker.addEventListener('click', () => {
  if (!selectedId) return;
  stickers = stickers.filter(s => s.id !== selectedId);
  selectedId = null;
  renderStickers();
  hideEditor();
});

btnBringFront.addEventListener('click', () => {
  if (!selectedId) return;
  const s = getSticker(selectedId);
  if (!s) return;
  s.z = (stickers.length ? Math.max(...stickers.map(a => a.z)) : 0) + 1;
  renderStickers();
});

sizeSlider.addEventListener('input', () => {
  if (!selectedId) return;
  const s = getSticker(selectedId);
  if (!s) return;
  s.size = Number(sizeSlider.value);
  renderStickers();
});

rotSlider.addEventListener('input', () => {
  if (!selectedId) return;
  const s = getSticker(selectedId);
  if (!s) return;
  s.rot = Number(rotSlider.value);
  renderStickers();
});

/* --- Vlečenje nalepk (pointer events) --- */
let drag = null;

function onStickerPointerDown(ev, id) {
  ev.preventDefault();
  ev.stopPropagation();

  selectSticker(id);

  const s = getSticker(id);
  if (!s) return;

  const { w, h } = stageSize();
  const rect = stage.getBoundingClientRect();

  drag = {
    id,
    pointerId: ev.pointerId,
    startX: ev.clientX,
    startY: ev.clientY,
    startStickerX: s.x,
    startStickerY: s.y,
    rect,
    w,
    h
  };

  // zajamemo pointer, da vlečenje deluje tudi če prst “uide”
  ev.currentTarget.setPointerCapture(ev.pointerId);
}

stickersLayer.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (ev.pointerId !== drag.pointerId) return;

  const s = getSticker(drag.id);
  if (!s) return;

  const dx = ev.clientX - drag.startX;
  const dy = ev.clientY - drag.startY;

  // pretvorimo piksele v normalizirane koordinate
  let nx = drag.startStickerX + dx / drag.w;
  let ny = drag.startStickerY + dy / drag.h;

  // omejitev v okvir (malo “safe” roba)
  nx = clamp(nx, 0.03, 0.97);
  ny = clamp(ny, 0.03, 0.97);

  s.x = nx;
  s.y = ny;

  renderStickers();
});

stickersLayer.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  if (ev.pointerId !== drag.pointerId) return;
  drag = null;
});

stickersLayer.addEventListener('pointercancel', () => {
  drag = null;
});

// tap na prazno: odznači
stage.addEventListener('pointerdown', (ev) => {
  // Če tapneš po nalepki, se to ustavi v stopPropagation, zato tu velja “prazno območje”
  if (ev.target.closest('.sticker')) return;
  selectedId = null;
  renderStickers();
  hideEditor();
});

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* -------------------- Fotografiranje (9:16) -------------------- */
const OUT_W = 1080;
const OUT_H = 1920;

btnShot.addEventListener('click', async () => {
  try {
    if (!stream) await startCamera();

    // počakaj, da je overlay naložen (pomembno za izvoz)
    await ensureImageLoaded(overlayImg);

    // Ustvari sliko (video + overlay + nalepke)
    const { dataUrl, blob } = await captureCompositePNG();

    // Primarni poskus: download (<a download>)
    const ok = tryDownload(dataUrl);

    // Vedno mora biti rezultat: če download ni realno izvedljiv, pokažemo modal (fallback)
    if (!ok) {
      await openModal(dataUrl, blob);
    } else {
      // pri nekaterih iOS scenarijih se “download” sicer klikne, a ne shrani → zato še vedno pokažemo fallback,
      // če zaznamo iOS Safari (varneje, da uporabnik vidi rezultat)
      if (isLikelyIOSSafari()) {
        await openModal(dataUrl, blob);
      }
    }
  } catch (err) {
    console.error(err);
    setStatus('Napaka pri fotografiranju. Preveri dovoljenja za kamero.', 3000);
  }
});

function isLikelyIOSSafari() {
  const ua = navigator.userAgent || '';
  const iOS = /iP(hone|ad|od)/.test(ua);
  const webkit = /WebKit/.test(ua);
  const isChromeiOS = /CriOS/.test(ua);
  return iOS && webkit && !isChromeiOS;
}

function tryDownload(dataUrl) {
  // Nekateri brskalniki ignorirajo download pri data URL; poskusimo vseeno
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'fotofilter.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

async function captureCompositePNG() {
  // Offscreen canvas za final 1080x1920
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');

  // 1) narišemo video kot “cover” v 9:16 (enako kot preview)
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // cover crop iz video razmerja v 9:16
  const targetRatio = OUT_W / OUT_H;
  const videoRatio = vw / vh;

  let sx, sy, sw, sh;
  if (videoRatio > targetRatio) {
    // video je “preširok” → režemo levo/desno
    sh = vh;
    sw = Math.round(vh * targetRatio);
    sx = Math.round((vw - sw) / 2);
    sy = 0;
  } else {
    // video je “previsok” → režemo zgoraj/spodaj
    sw = vw;
    sh = Math.round(vw / targetRatio);
    sx = 0;
    sy = Math.round((vh - sh) / 2);
  }

  // Če je selfie, zrcalimo video, da final slika izgleda enako kot preview
  if (isMirrored) {
    ctx.save();
    ctx.translate(OUT_W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
    ctx.restore();
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
  }

  // 2) overlay “contain” (enako kot CSS object-fit: contain)
  // overlay ima svoje naravno razmerje; rišemo ga “contain” v 9:16 canvas
  const ow = overlayImg.naturalWidth;
  const oh = overlayImg.naturalHeight;

  const stageW = OUT_W;
  const stageH = OUT_H;
  const scale = Math.min(stageW / ow, stageH / oh);
  const dw = ow * scale;
  const dh = oh * scale;
  const dx = (stageW - dw) / 2;
  const dy = (stageH - dh) / 2;

  ctx.drawImage(overlayImg, dx, dy, dw, dh);

  // 3) nalepke (emoji) – rišemo kot tekst
  // font-size v px je vezan na preview; tukaj ga pretvorimo relativno glede na stage širino
  const preview = stageSize();
  const sxScale = OUT_W / preview.w; // približek: vzamemo scale po širini; dovolj natančno za 9:16

  // uredimo po z
  const sorted = [...stickers].sort((a,b) => a.z - b.z);

  for (const s of sorted) {
    const px = s.x * OUT_W;
    const py = s.y * OUT_H;
    const fontPx = Math.max(10, s.size * sxScale);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((s.rot * Math.PI) / 180);

    ctx.font = `${fontPx}px system-ui, -apple-system, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // rahla senca za berljivost
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = fontPx * 0.18;
    ctx.shadowOffsetY = fontPx * 0.08;

    ctx.fillText(s.emoji, 0, 0);

    ctx.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');

  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });

  return { dataUrl, blob };
}

function ensureImageLoaded(img) {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Overlay image failed to load'));
  });
}

/* -------------------- Modal fallback + Share -------------------- */
let lastBlob = null;

async function openModal(dataUrl, blob) {
  lastBlob = blob || null;

  resultImg.src = dataUrl;
  downloadLink.href = dataUrl;

  // Share gumb: pokaži le, če je smiselno
  const canShareFiles = !!(navigator.share && blob);
  btnShare.style.display = canShareFiles ? 'inline-flex' : 'none';

  modal.hidden = false;
}

btnCloseModal.addEventListener('click', () => {
  modal.hidden = true;
});

modal.addEventListener('click', (ev) => {
  // klik izven kartice zapre
  if (ev.target === modal) modal.hidden = true;
});

btnShare.addEventListener('click', async () => {
  if (!navigator.share || !lastBlob) return;

  try {
    const file = new File([lastBlob], 'fotofilter.png', { type: 'image/png' });
    await navigator.share({
      files: [file],
      title: 'Fotofilter',
      text: 'Fotofilter slika'
    });
  } catch (err) {
    // Uporabnik lahko prekliče; to ni napaka
    console.log('Share cancelled or failed', err);
  }
});

/* -------------------- Init -------------------- */
function supportsGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

(async function init() {
  buildEmojiBar();

  if (!supportsGetUserMedia()) {
    setStatus('Ta brskalnik ne podpira kamere (getUserMedia).', 0);
    return;
  }

  // iOS: kamera se pogosto zažene šele po user gesture,
  // ampak večina sodobnih brskalnikov dovoljuje start na load; če ne, bo ob prvem kliku.
  try {
    await startCamera();
  } catch (e) {
    console.warn(e);
    setStatus('Klikni “📸 Fotografiraj” ali “🔄 Obrni kamero”, da dovoliš kamero.', 0);
  }

  // Ko se spremeni velikost okna, preračunamo pozicije nalepk (normalizirane → OK), samo rerender
  window.addEventListener('resize', () => renderStickers());
})();
