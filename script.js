// script.js (POPOLNOMA POPRAVLJEN)
// Brez knjižnic. Kamera + overlay + emoji nalepke + foto 1080x1920 + robusten modal (zapiranje vedno dela).

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

/* -------------------- Helpers -------------------- */
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

let statusTimer = null;
function setStatus(msg, autoHideMs = 0){
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  clearTimeout(statusTimer);
  if(autoHideMs > 0){
    statusTimer = setTimeout(() => statusEl.style.display = 'none', autoHideMs);
  }
}

function supportsGetUserMedia(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function isLikelyIOSSafari(){
  const ua = navigator.userAgent || '';
  const iOS = /iP(hone|ad|od)/.test(ua);
  const webkit = /WebKit/.test(ua);
  const isChromeiOS = /CriOS/.test(ua);
  return iOS && webkit && !isChromeiOS;
}

function stageSize(){
  const r = stage.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

function ensureImageLoaded(img){
  return new Promise((resolve, reject) => {
    if(img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Overlay image failed to load'));
  });
}

/* -------------------- Kamera -------------------- */
let stream = null;
let facingMode = 'user';
let isMirrored = true;

function stopCamera(){
  if(stream){
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

async function startCamera(){
  setStatus('Zaganjam kamero…');

  stopCamera();

  // poskusi “ideal facingMode”, potem fallback
  const constraints1 = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };

  try{
    stream = await navigator.mediaDevices.getUserMedia(constraints1);
  }catch(e1){
    try{
      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode } });
    }catch(e2){
      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:true });
      facingMode = 'user';
    }
  }

  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();

  isMirrored = (facingMode === 'user');
  video.style.transform = isMirrored ? 'scaleX(-1)' : 'none';

  setStatus('Kamera pripravljena ✅', 1200);
}

btnFlip.addEventListener('click', async () => {
  facingMode = (facingMode === 'user') ? 'environment' : 'user';
  await startCamera();
});

/* -------------------- Emoji nalepke -------------------- */
let stickers = [];
let selectedId = null;
let nextId = 1;

const defaultEmojis = [
  "🚜", "🌸", "🐴", "🐄", "🧪", "🔬", "🧬", "🍎", "🥛",
  "🧁", "🎂", "🥩", "🎓", "📚", "🪴", "🍅"
];

function buildEmojiBar(){
  emojiBar.innerHTML = '';
  defaultEmojis.forEach(emo => {
    const b = document.createElement('button');
    b.className = 'emoji-btn';
    b.type = 'button';
    b.textContent = emo;
    b.addEventListener('click', () => addSticker(emo));
    emojiBar.appendChild(b);
  });
}

function addSticker(emoji){
  const id = String(nextId++);
  const s = {
    id,
    emoji,
    x: 0.5,
    y: 0.55,
    size: 96,
    rot: 0,
    z: stickers.length ? Math.max(...stickers.map(a => a.z)) + 1 : 1
  };
  stickers.push(s);
  renderStickers();
  selectSticker(id);
}

function clearStickers(){
  stickers = [];
  selectedId = null;
  renderStickers();
  hideEditor();
}

btnClearStickers.addEventListener('click', clearStickers);

btnCustomEmoji.addEventListener('click', () => {
  const val = prompt("Vpiši emoji (npr. 🐝 ali 👩‍🌾):");
  if(!val) return;
  addSticker(val.trim());
});

function getSticker(id){
  return stickers.find(s => s.id === id) || null;
}

function selectSticker(id){
  selectedId = id;
  renderStickers();
  showEditorFor(id);
}

function showEditorFor(id){
  const s = getSticker(id);
  if(!s) return hideEditor();
  editor.hidden = false;
  sizeSlider.value = String(Math.round(s.size));
  rotSlider.value = String(Math.round(s.rot));
}

function hideEditor(){
  editor.hidden = true;
}

btnDoneEdit.addEventListener('click', () => {
  selectedId = null;
  renderStickers();
  hideEditor();
});

btnDeleteSticker.addEventListener('click', () => {
  if(!selectedId) return;
  stickers = stickers.filter(s => s.id !== selectedId);
  selectedId = null;
  renderStickers();
  hideEditor();
});

btnBringFront.addEventListener('click', () => {
  if(!selectedId) return;
  const s = getSticker(selectedId);
  if(!s) return;
  s.z = (stickers.length ? Math.max(...stickers.map(a => a.z)) : 0) + 1;
  renderStickers();
});

sizeSlider.addEventListener('input', () => {
  if(!selectedId) return;
  const s = getSticker(selectedId);
  if(!s) return;
  s.size = Number(sizeSlider.value);
  renderStickers();
});

rotSlider.addEventListener('input', () => {
  if(!selectedId) return;
  const s = getSticker(selectedId);
  if(!s) return;
  s.rot = Number(rotSlider.value);
  renderStickers();
});

function renderStickers(){
  stickersLayer.innerHTML = '';
  const sorted = [...stickers].sort((a,b) => a.z - b.z);
  const { w, h } = stageSize();

  sorted.forEach(s => {
    const el = document.createElement('div');
    el.className = 'sticker' + (s.id === selectedId ? ' selected' : '');
    el.dataset.id = s.id;
    el.textContent = s.emoji;

    el.style.left = `${s.x * w}px`;
    el.style.top  = `${s.y * h}px`;
    el.style.fontSize = `${s.size}px`;
    el.style.transform = `translate(-50%,-50%) rotate(${s.rot}deg)`;

    el.addEventListener('pointerdown', (ev) => onStickerPointerDown(ev, s.id));
    stickersLayer.appendChild(el);
  });
}

/* --- Dragging (pointer) --- */
let drag = null;

function onStickerPointerDown(ev, id){
  ev.preventDefault();
  ev.stopPropagation();

  selectSticker(id);

  const s = getSticker(id);
  if(!s) return;

  const { w, h } = stageSize();

  drag = {
    id,
    pointerId: ev.pointerId,
    startX: ev.clientX,
    startY: ev.clientY,
    startStickerX: s.x,
    startStickerY: s.y,
    w,
    h
  };

  ev.currentTarget.setPointerCapture(ev.pointerId);
}

stickersLayer.addEventListener('pointermove', (ev) => {
  if(!drag) return;
  if(ev.pointerId !== drag.pointerId) return;

  const s = getSticker(drag.id);
  if(!s) return;

  const dx = ev.clientX - drag.startX;
  const dy = ev.clientY - drag.startY;

  let nx = drag.startStickerX + dx / drag.w;
  let ny = drag.startStickerY + dy / drag.h;

  nx = clamp(nx, 0.03, 0.97);
  ny = clamp(ny, 0.03, 0.97);

  s.x = nx;
  s.y = ny;

  renderStickers();
});

stickersLayer.addEventListener('pointerup', (ev) => {
  if(!drag) return;
  if(ev.pointerId !== drag.pointerId) return;
  drag = null;
});

stickersLayer.addEventListener('pointercancel', () => { drag = null; });

// tap na prazno -> odznači
stage.addEventListener('pointerdown', (ev) => {
  if(ev.target.closest('.sticker')) return;
  selectedId = null;
  renderStickers();
  hideEditor();
});

/* -------------------- Fotografiranje -------------------- */
const OUT_W = 1080;
const OUT_H = 1920;

btnShot.addEventListener('click', async () => {
  try{
    if(!stream) await startCamera();
    await ensureImageLoaded(overlayImg);

    const { dataUrl, blob } = await captureCompositePNG();

    // poskusi download
    const ok = tryDownload(dataUrl);

    // vedn rezultat: pri iOS ali če download ni ok -> modal
    if(!ok || isLikelyIOSSafari()){
      await openModal(dataUrl, blob);
    }

  }catch(err){
    console.error(err);
    setStatus('Napaka pri fotografiranju. Preveri dovoljenja za kamero.', 3000);
  }
});

function tryDownload(dataUrl){
  try{
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'fotofilter.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }catch{
    return false;
  }
}

async function captureCompositePNG(){
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const targetRatio = OUT_W / OUT_H;
  const videoRatio = vw / vh;

  let sx, sy, sw, sh;
  if(videoRatio > targetRatio){
    sh = vh;
    sw = Math.round(vh * targetRatio);
    sx = Math.round((vw - sw) / 2);
    sy = 0;
  }else{
    sw = vw;
    sh = Math.round(vw / targetRatio);
    sx = 0;
    sy = Math.round((vh - sh) / 2);
  }

  // video
  if(isMirrored){
    ctx.save();
    ctx.translate(OUT_W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
    ctx.restore();
  }else{
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
  }

  // overlay (contain)
  const ow = overlayImg.naturalWidth;
  const oh = overlayImg.naturalHeight;
  const scale = Math.min(OUT_W / ow, OUT_H / oh);
  const dw = ow * scale;
  const dh = oh * scale;
  const dx = (OUT_W - dw) / 2;
  const dy = (OUT_H - dh) / 2;

  ctx.drawImage(overlayImg, dx, dy, dw, dh);

  // stickers (emoji as text)
  const preview = stageSize();
  const scalePx = OUT_W / preview.w; // dovolj natančno

  const sorted = [...stickers].sort((a,b) => a.z - b.z);

  for(const s of sorted){
    const px = s.x * OUT_W;
    const py = s.y * OUT_H;
    const fontPx = Math.max(10, s.size * scalePx);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((s.rot * Math.PI) / 180);

    ctx.font = `${fontPx}px system-ui, -apple-system, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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

/* -------------------- Modal (ROBUSTEN) -------------------- */
let lastBlob = null;

function closeModal(){
  // robustno: skrij + počisti, da se nikoli “ne zalepi”
  modal.hidden = true;
  resultImg.src = '';
  downloadLink.href = '#';
  lastBlob = null;

  // še: če bi brskalnik pustil focus, ga odmaknemo
  if(document.activeElement) document.activeElement.blur?.();
}

async function openModal(dataUrl, blob){
  lastBlob = blob || null;

  resultImg.src = dataUrl;
  downloadLink.href = dataUrl;

  const canShareFiles = !!(navigator.share && blob);
  btnShare.style.display = canShareFiles ? 'inline-flex' : 'none';

  modal.hidden = false;
}

btnCloseModal.addEventListener('click', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  closeModal();
});

modal.addEventListener('click', (ev) => {
  // klik na ozadje (izven kartice) zapre
  if(ev.target === modal) closeModal();
});

// ESC zapre (na računalniku)
window.addEventListener('keydown', (ev) => {
  if(ev.key === 'Escape' && !modal.hidden) closeModal();
});

btnShare.addEventListener('click', async () => {
  if(!navigator.share || !lastBlob) return;

  try{
    const file = new File([lastBlob], 'fotofilter.png', { type:'image/png' });
    await navigator.share({
      files:[file],
      title:'Fotofilter',
      text:'Fotofilter slika'
    });
  }catch(err){
    // preklic je normalen
    console.log('Share cancelled/failed:', err);
  }
});

/* -------------------- Init -------------------- */
(async function init(){
  buildEmojiBar();

  if(!supportsGetUserMedia()){
    setStatus('Ta brskalnik ne podpira kamere (getUserMedia).', 0);
    return;
  }

  // prevent “stuck modal” na refresh (varnost)
  closeModal();

  try{
    await startCamera();
  }catch(e){
    console.warn(e);
    setStatus('Klikni “📸 Fotografiraj” ali “🔄 Obrni kamero”, da dovoliš kamero.', 0);
  }

  window.addEventListener('resize', () => renderStickers());
})();
