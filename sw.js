// 離線快取：任何檔案改動後都要把 VERSION 加一（wp-life-v1 → wp-life-v2），新增的素材也要加進 CORE 清單。
const VERSION = 'wp-life-v10';
const CORE = [
  './',
  './index.html',
  './growth.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/backgrounds/bg_forest_day.webp',
  './assets/backgrounds/bg_forest_dusk.webp',
  './assets/backgrounds/bg_forest_night.webp',
  './assets/characters/egg/act/egg_act_idle.webp',
  './assets/characters/baby/act/baby_act_idle.webp',
  './assets/characters/kuri/act/kuri_act_idle.webp',
  './assets/characters/kuri/act/kuri_act_eat.webp',
  './assets/characters/kuri/act/kuri_act_sleep.webp',
  './assets/characters/kuri/act/kuri_act_play.webp',
  './assets/characters/kuri/act/kuri_act_sick.webp',
  './assets/characters/sunny/act/sunny_act_idle.webp',
  './assets/characters/sunny/act/sunny_act_eat.webp',
  './assets/characters/sunny/act/sunny_act_sleep.webp',
  './assets/characters/sunny/act/sunny_act_play.webp',
  './assets/characters/sunny/act/sunny_act_sick.webp',
  './assets/characters/dodo/act/dodo_act_idle.webp',
  './assets/characters/dodo/act/dodo_act_eat.webp',
  './assets/characters/dodo/act/dodo_act_sleep.webp',
  './assets/characters/dodo/act/dodo_act_play.webp',
  './assets/characters/dodo/act/dodo_act_sick.webp',
  './assets/characters/piko/act/piko_act_idle.webp',
  './assets/characters/piko/act/piko_act_eat.webp',
  './assets/characters/piko/act/piko_act_sleep.webp',
  './assets/characters/piko/act/piko_act_play.webp',
  './assets/characters/piko/act/piko_act_sick.webp',
  './assets/characters/kuri_p/act/kuri_p_act_idle.webp',
  './assets/characters/kuri_r/act/kuri_r_act_idle.webp',
  './assets/characters/kuri_f/act/kuri_f_act_idle.webp',
  './assets/characters/kuri_h/act/kuri_h_act_idle.webp',
  './assets/characters/sunny_p/act/sunny_p_act_idle.webp',
  './assets/characters/sunny_r/act/sunny_r_act_idle.webp',
  './assets/characters/sunny_f/act/sunny_f_act_idle.webp',
  './assets/characters/sunny_h/act/sunny_h_act_idle.webp',
  './assets/characters/dodo_p/act/dodo_p_act_idle.webp',
  './assets/characters/dodo_r/act/dodo_r_act_idle.webp',
  './assets/characters/dodo_f/act/dodo_f_act_idle.webp',
  './assets/characters/dodo_h/act/dodo_h_act_idle.webp',
  './assets/characters/piko_p/act/piko_p_act_idle.webp',
  './assets/characters/piko_r/act/piko_r_act_idle.webp',
  './assets/characters/piko_f/act/piko_f_act_idle.webp',
  './assets/characters/piko_h/act/piko_h_act_idle.webp',
  './assets/characters/dodo/face/dodo_face_hug.webp',
  './assets/characters/dodo/face/dodo_face_hungry.webp',
  './assets/characters/dodo/face/dodo_face_ok.webp',
  './assets/characters/dodo/face/dodo_face_sad.webp',
  './assets/characters/dodo/face/dodo_face_smile.webp',
  './assets/characters/dodo/face/dodo_face_sweat.webp',
  './assets/characters/kuri/face/kuri_face_cry.webp',
  './assets/characters/kuri/face/kuri_face_laugh.webp',
  './assets/characters/kuri/face/kuri_face_love.webp',
  './assets/characters/kuri/face/kuri_face_shy.webp',
  './assets/characters/kuri/face/kuri_face_sleepy.webp',
  './assets/characters/kuri/face/kuri_face_thumb.webp',
  './assets/characters/piko/face/piko_face_giggle.webp',
  './assets/characters/piko/face/piko_face_hmph.webp',
  './assets/characters/piko/face/piko_face_laughcry.webp',
  './assets/characters/piko/face/piko_face_speechless.webp',
  './assets/characters/piko/face/piko_face_surprised.webp',
  './assets/characters/piko/face/piko_face_think.webp',
  './assets/characters/sunny/face/sunny_face_angry.webp',
  './assets/characters/sunny/face/sunny_face_confused.webp',
  './assets/characters/sunny/face/sunny_face_shock.webp',
  './assets/characters/sunny/face/sunny_face_smug.webp',
  './assets/characters/sunny/face/sunny_face_stareyes.webp',
  './assets/characters/sunny/face/sunny_face_wink.webp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 遊戲頁面：先用網路拿最新版，沒網路時用快取
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // 其他檔案與 Google 字型：先用快取，沒有才下載並存起來
  if (url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
