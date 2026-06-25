'use strict';

/* =========================================================
   タブ切り替え
   ========================================================= */
const tabs = document.querySelectorAll('.drawer-tab');
const panels = document.querySelectorAll('.panel');

function activateTab(target){
  tabs.forEach(t => {
    const active = t.dataset.target === target;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-current', active ? 'true' : 'false');
  });
  panels.forEach(p => p.classList.toggle('is-active', p.id === `panel-${target}`));
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.target));
});

/* =========================================================
   URLクエリ（?tab=timer など）でタブを直接開く
   ========================================================= */
(function openTabFromQuery(){
  const requested = new URLSearchParams(location.search).get('tab');
  if (!requested) return;
  const exists = document.querySelector(`.drawer-tab[data-target="${requested}"]`);
  if (exists) activateTab(requested);
})();

/* =========================================================
   時計（ナビ下部）
   ========================================================= */
const clockEl = document.getElementById('clock');
function tickClock(){
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 1000 * 15);

/* =========================================================
   PWAインストールボタン
   ========================================================= */
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
});

/* =========================================================
   Service Worker 登録
   ========================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* オフライン機能が使えないだけなので、サイト自体は通常通り動作 */
    });
  });
}

/* =========================================================
   01. メモ / ToDo
   ========================================================= */
const TODO_KEY = 'desk.todos.v1';
let todos = [];

try {
  todos = JSON.parse(localStorage.getItem(TODO_KEY)) || [];
} catch {
  todos = [];
}

const todoForm = document.getElementById('todoForm');
const todoInput = document.getElementById('todoInput');
const todoListEl = document.getElementById('todoList');
const todoEmpty = document.getElementById('todoEmpty');
const todoCount = document.getElementById('todoCount');
const clearDoneBtn = document.getElementById('clearDone');

function saveTodos(){
  localStorage.setItem(TODO_KEY, JSON.stringify(todos));
}

function renderTodos(){
  todoListEl.innerHTML = '';
  todoEmpty.style.display = todos.length === 0 ? 'block' : 'none';

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' is-done' : '');

    const check = document.createElement('button');
    check.className = 'check';
    check.setAttribute('aria-label', todo.done ? '未完了に戻す' : '完了にする');
    check.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    check.addEventListener('click', () => {
      todo.done = !todo.done;
      saveTodos();
      renderTodos();
    });

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'del';
    del.setAttribute('aria-label', '削除');
    del.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    del.addEventListener('click', () => {
      todos = todos.filter(t => t.id !== todo.id);
      saveTodos();
      renderTodos();
    });

    li.append(check, text, del);
    todoListEl.appendChild(li);
  });

  const doneCount = todos.filter(t => t.done).length;
  todoCount.textContent = `${todos.length} 件のタスク（完了 ${doneCount} 件）`;
}

todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = todoInput.value.trim();
  if (!value) return;
  todos.unshift({ id: crypto.randomUUID(), text: value, done: false });
  todoInput.value = '';
  saveTodos();
  renderTodos();
});

clearDoneBtn.addEventListener('click', () => {
  todos = todos.filter(t => !t.done);
  saveTodos();
  renderTodos();
});

renderTodos();

/* =========================================================
   02. タイマー / ポモドーロ
   ========================================================= */
const modeButtons = document.querySelectorAll('#panel-timer .mode-btn');
const customTimeRow = document.getElementById('customTimeRow');
const customMinutesInput = document.getElementById('customMinutes');
const timerTimeEl = document.getElementById('timerTime');
const timerPhaseEl = document.getElementById('timerPhase');
const timerToggleBtn = document.getElementById('timerToggle');
const timerResetBtn = document.getElementById('timerReset');
const timerSkipBtn = document.getElementById('timerSkip');
const pomodoroCountEl = document.getElementById('pomodoroCount');
const ringProgress = document.getElementById('ringProgress');

const RING_CIRCUMFERENCE = 2 * Math.PI * 98; // r=98

let timerMode = 'pomodoro'; // 'pomodoro' | 'custom'
let phase = 'focus';        // pomodoro時のみ使う: 'focus' | 'break'
let totalSeconds = 25 * 60;
let remainingSeconds = totalSeconds;
let isRunning = false;
let intervalId = null;
let pomodoroCount = 0;

const PHASE_LABEL = { focus: '集中タイム', break: '休憩タイム' };
const PHASE_SECONDS = { focus: 25 * 60, break: 5 * 60 };

function formatTime(sec){
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing(){
  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
}

function renderTimer(){
  timerTimeEl.textContent = formatTime(remainingSeconds);
  timerPhaseEl.textContent = timerMode === 'pomodoro' ? PHASE_LABEL[phase] : 'カスタムタイマー';
  pomodoroCountEl.textContent = String(pomodoroCount);
  updateRing();
}

ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

function setMode(mode){
  timerMode = mode;
  modeButtons.forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  customTimeRow.hidden = mode !== 'custom';
  stopTimer();
  resetTimerValues();
}

function resetTimerValues(){
  if (timerMode === 'pomodoro') {
    phase = 'focus';
    totalSeconds = PHASE_SECONDS.focus;
  } else {
    const mins = Math.min(180, Math.max(1, parseInt(customMinutesInput.value, 10) || 10));
    totalSeconds = mins * 60;
  }
  remainingSeconds = totalSeconds;
  renderTimer();
}

modeButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
customMinutesInput.addEventListener('change', () => {
  if (timerMode === 'custom' && !isRunning) resetTimerValues();
});

function tickTimer(){
  remainingSeconds -= 1;
  if (remainingSeconds <= 0) {
    handlePhaseEnd();
    return;
  }
  renderTimer();
}

function handlePhaseEnd(){
  stopTimer();
  notifyDeskUser();

  if (timerMode === 'pomodoro') {
    if (phase === 'focus') {
      pomodoroCount += 1;
      phase = 'break';
      totalSeconds = PHASE_SECONDS.break;
    } else {
      phase = 'focus';
      totalSeconds = PHASE_SECONDS.focus;
    }
    remainingSeconds = totalSeconds;
    renderTimer();
  } else {
    remainingSeconds = 0;
    renderTimer();
  }
}

function notifyDeskUser(){
  if ('Notification' in window && Notification.permission === 'granted') {
    const label = timerMode === 'pomodoro'
      ? (phase === 'focus' ? '集中タイムが終わりました。休憩しましょう。' : '休憩が終わりました。再開しましょう。')
      : 'タイマーが終了しました。';
    new Notification('Desk タイマー', { body: label, icon: 'icon-192.png' });
  } else if (navigator.vibrate) {
    navigator.vibrate(200);
  }
}

function startTimer(){
  if (isRunning) return;
  isRunning = true;
  timerToggleBtn.textContent = '一時停止';
  intervalId = setInterval(tickTimer, 1000);

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function stopTimer(){
  isRunning = false;
  timerToggleBtn.textContent = '開始';
  clearInterval(intervalId);
  intervalId = null;
}

timerToggleBtn.addEventListener('click', () => {
  isRunning ? stopTimer() : startTimer();
});

timerResetBtn.addEventListener('click', () => {
  stopTimer();
  resetTimerValues();
});

timerSkipBtn.addEventListener('click', () => {
  handlePhaseEnd();
});

renderTimer();

/* =========================================================
   03. 電卓
   ========================================================= */
const calcModeButtons = document.querySelectorAll('#panel-calc .mode-btn');
const calcBasicView = document.getElementById('calcBasic');
const calcConvertView = document.getElementById('calcConvert');

calcModeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    calcModeButtons.forEach(b => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const isBasic = btn.dataset.mode === 'basic';
    calcBasicView.hidden = !isBasic;
    calcConvertView.hidden = isBasic;
  });
});

const calcExprEl = document.getElementById('calcExpr');
const calcResultEl = document.getElementById('calcResult');
const calcKeysEl = document.getElementById('calcKeys');

const KEY_LAYOUT = [
  { label: 'C', type: 'clear' },
  { label: '←', type: 'back' },
  { label: '%', type: 'op', value: '%' },
  { label: '÷', type: 'op', value: '/' },
  { label: '7', type: 'digit' }, { label: '8', type: 'digit' }, { label: '9', type: 'digit' },
  { label: '×', type: 'op', value: '*' },
  { label: '4', type: 'digit' }, { label: '5', type: 'digit' }, { label: '6', type: 'digit' },
  { label: '−', type: 'op', value: '-' },
  { label: '1', type: 'digit' }, { label: '2', type: 'digit' }, { label: '3', type: 'digit' },
  { label: '+', type: 'op', value: '+' },
  { label: '0', type: 'digit', wide: true }, { label: '.', type: 'digit' },
  { label: '=', type: 'equals' },
];

let calcExpr = '';

function renderCalcKeys(){
  calcKeysEl.innerHTML = '';
  KEY_LAYOUT.forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = key.label;
    if (key.type === 'op') btn.classList.add('op');
    if (key.type === 'equals') btn.classList.add('equals');
    if (key.wide) btn.classList.add('wide');
    btn.addEventListener('click', () => handleCalcKey(key));
    calcKeysEl.appendChild(btn);
  });
}

function safeEvalExpr(expr){
  // 数字・演算子・括弧・小数点・%のみを許可してから評価する
  if (!/^[0-9+\-*/.%\s]+$/.test(expr)) throw new Error('invalid');
  const sanitized = expr.replace(/%/g, '/100');
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict"; return (${sanitized});`)();
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('invalid');
  return value;
}

function handleCalcKey(key){
  if (key.type === 'clear') {
    calcExpr = '';
  } else if (key.type === 'back') {
    calcExpr = calcExpr.slice(0, -1);
  } else if (key.type === 'digit') {
    calcExpr += key.label;
  } else if (key.type === 'op') {
    if (calcExpr === '' && key.value !== '-') return;
    calcExpr += key.value;
  } else if (key.type === 'equals') {
    try {
      const result = safeEvalExpr(calcExpr);
      calcExprEl.textContent = calcExpr + ' =';
      calcResultEl.textContent = String(Math.round(result * 1e8) / 1e8);
      calcExpr = String(Math.round(result * 1e8) / 1e8);
      return;
    } catch {
      calcResultEl.textContent = 'エラー';
      calcExpr = '';
      calcExprEl.textContent = '\u00a0';
      return;
    }
  }
  calcExprEl.textContent = calcExpr || '\u00a0';
  calcResultEl.textContent = calcExpr === '' ? '0' : calcExpr;
}

renderCalcKeys();

/* =========================================================
   03b. 単位変換
   ========================================================= */
const UNIT_GROUPS = {
  length: {
    label: '長さ',
    base: 'm',
    units: {
      mm: { label: 'ミリメートル', toBase: v => v / 1000, fromBase: v => v * 1000 },
      cm: { label: 'センチメートル', toBase: v => v / 100, fromBase: v => v * 100 },
      m:  { label: 'メートル', toBase: v => v, fromBase: v => v },
      km: { label: 'キロメートル', toBase: v => v * 1000, fromBase: v => v / 1000 },
      inch: { label: 'インチ', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
      ft: { label: 'フィート', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      mile: { label: 'マイル', toBase: v => v * 1609.34, fromBase: v => v / 1609.34 },
    },
  },
  weight: {
    label: '重さ',
    base: 'kg',
    units: {
      mg: { label: 'ミリグラム', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
      g:  { label: 'グラム', toBase: v => v / 1000, fromBase: v => v * 1000 },
      kg: { label: 'キログラム', toBase: v => v, fromBase: v => v },
      lb: { label: 'ポンド', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
      oz: { label: 'オンス', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 },
    },
  },
  temp: {
    label: '温度',
    base: 'c',
    units: {
      c: { label: '摂氏 (°C)', toBase: v => v, fromBase: v => v },
      f: { label: '華氏 (°F)', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
      k: { label: 'ケルビン (K)', toBase: v => v - 273.15, fromBase: v => v + 273.15 },
    },
  },
  volume: {
    label: '体積',
    base: 'l',
    units: {
      ml: { label: 'ミリリットル', toBase: v => v / 1000, fromBase: v => v * 1000 },
      l:  { label: 'リットル', toBase: v => v, fromBase: v => v },
      gal: { label: '米ガロン', toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
      cup: { label: 'カップ(米)', toBase: v => v * 0.236588, fromBase: v => v / 0.236588 },
    },
  },
  area: {
    label: '面積',
    base: 'm2',
    units: {
      m2: { label: '平方メートル', toBase: v => v, fromBase: v => v },
      km2: { label: '平方キロメートル', toBase: v => v * 1e6, fromBase: v => v / 1e6 },
      tsubo: { label: '坪', toBase: v => v * 3.30579, fromBase: v => v / 3.30579 },
      acre: { label: 'エーカー', toBase: v => v * 4046.86, fromBase: v => v / 4046.86 },
    },
  },
};

const convCategorySelect = document.getElementById('convCategory');
const convFromUnitSelect = document.getElementById('convFromUnit');
const convToUnitSelect = document.getElementById('convToUnit');
const convFromValueInput = document.getElementById('convFromValue');
const convToValueInput = document.getElementById('convToValue');
const convSwapBtn = document.getElementById('convSwap');

function populateCategorySelect(){
  Object.entries(UNIT_GROUPS).forEach(([key, group]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = group.label;
    convCategorySelect.appendChild(opt);
  });
}

function populateUnitSelects(){
  const group = UNIT_GROUPS[convCategorySelect.value];
  [convFromUnitSelect, convToUnitSelect].forEach(sel => (sel.innerHTML = ''));
  Object.entries(group.units).forEach(([key, unit], i) => {
    const optFrom = document.createElement('option');
    optFrom.value = key;
    optFrom.textContent = unit.label;
    convFromUnitSelect.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = key;
    optTo.textContent = unit.label;
    convToUnitSelect.appendChild(optTo);
  });
  // デフォルトは異なる単位2つを選んでおく
  const keys = Object.keys(group.units);
  convFromUnitSelect.value = keys[0];
  convToUnitSelect.value = keys[Math.min(1, keys.length - 1)];
}

function runConversion(){
  const group = UNIT_GROUPS[convCategorySelect.value];
  const fromUnit = group.units[convFromUnitSelect.value];
  const toUnit = group.units[convToUnitSelect.value];
  const inputVal = parseFloat(convFromValueInput.value);

  if (Number.isNaN(inputVal)) {
    convToValueInput.value = '';
    return;
  }
  const baseVal = fromUnit.toBase(inputVal);
  const result = toUnit.fromBase(baseVal);
  convToValueInput.value = String(Math.round(result * 1e6) / 1e6);
}

convCategorySelect.addEventListener('change', () => {
  populateUnitSelects();
  runConversion();
});
[convFromUnitSelect, convToUnitSelect, convFromValueInput].forEach(el => {
  el.addEventListener('input', runConversion);
  el.addEventListener('change', runConversion);
});
convSwapBtn.addEventListener('click', () => {
  const f = convFromUnitSelect.value;
  convFromUnitSelect.value = convToUnitSelect.value;
  convToUnitSelect.value = f;
  runConversion();
});

populateCategorySelect();
populateUnitSelects();
runConversion();

/* =========================================================
   04. 天気
   ========================================================= */
const weatherForm = document.getElementById('weatherForm');
const weatherCityInput = document.getElementById('weatherCity');
const weatherGeoBtn = document.getElementById('weatherGeo');
const weatherCard = document.getElementById('weatherCard');

const WEATHER_CODE_MAP = {
  0: '快晴', 1: '晴れ', 2: '晴れ時々曇り', 3: '曇り',
  45: '霧', 48: '霧（霜）',
  51: '弱い霧雨', 53: '霧雨', 55: '強い霧雨',
  61: '弱い雨', 63: '雨', 65: '強い雨',
  71: '弱い雪', 73: '雪', 75: '強い雪',
  80: 'にわか雨', 81: 'にわか雨（中）', 82: '激しいにわか雨',
  95: '雷雨', 96: '雷雨（あられ）', 99: '雷雨（強いあられ）',
};

function describeWeatherCode(code){
  return WEATHER_CODE_MAP[code] || '不明';
}

function setWeatherLoading(){
  weatherCard.innerHTML = '<p class="empty-state">天気を取得しています…</p>';
}

function setWeatherError(message){
  weatherCard.innerHTML = `<p class="empty-state">${message}</p>`;
}

async function geocodeCity(name){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=ja&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('geocode failed');
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error('not found');
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, label: [r.name, r.admin1, r.country].filter(Boolean).join(', ') };
}

async function fetchWeather(lat, lon, label){
  setWeatherLoading();
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&timezone=auto&forecast_days=5`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    const data = await res.json();
    renderWeather(data, label);
  } catch (err) {
    setWeatherError('天気データを取得できませんでした。時間をおいて再度お試しください。');
  }
}

function renderWeather(data, label){
  const cur = data.current;
  const daily = data.daily;
  const now = new Date(cur.time);

  const forecastHtml = daily.time.slice(0, 5).map((dateStr, i) => {
    const d = new Date(dateStr);
    const dayLabel = d.toLocaleDateString('ja-JP', { weekday: 'short' });
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    return `<div class="fc-day">${dayLabel}<b>${max}°/${min}°</b></div>`;
  }).join('');

  weatherCard.innerHTML = `
    <p class="weather-loc">${label}</p>
    <p class="weather-time">最終更新: ${now.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' })}</p>
    <div class="weather-now">
      <span class="weather-temp">${Math.round(cur.temperature_2m)}°</span>
      <span class="weather-desc">${describeWeatherCode(cur.weather_code)}</span>
    </div>
    <div class="weather-meta">
      <span>湿度 <b>${cur.relative_humidity_2m}%</b></span>
      <span>風速 <b>${cur.wind_speed_10m}</b> km/h</span>
    </div>
    <div class="weather-forecast">${forecastHtml}</div>
  `;
}

async function reverseGeocodeLabel(lat, lon){
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ja`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('reverse geocode failed');
    const data = await res.json();
    const place = data.city || data.locality || data.principalSubdivision;
    const region = data.principalSubdivision;
    const parts = [place, region === place ? null : region, data.countryName].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  } catch {
    return null;
  }
}

weatherForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = weatherCityInput.value.trim();
  if (!city) return;
  setWeatherLoading();
  try {
    const place = await geocodeCity(city);
    fetchWeather(place.lat, place.lon, place.label);
  } catch {
    setWeatherError('その都市が見つかりませんでした。スペルや表記を変えて再度お試しください。');
  }
});

weatherGeoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setWeatherError('このブラウザでは現在地が取得できません。');
    return;
  }
  setWeatherLoading();
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      // 地名の特定（逆引き）と天気取得は別々のAPIなので、地名が取れなくても天気表示は止めない
      const label = await reverseGeocodeLabel(latitude, longitude);
      fetchWeather(latitude, longitude, label || `現在地（緯度 ${latitude.toFixed(2)}, 経度 ${longitude.toFixed(2)}）`);
    },
    () => setWeatherError('現在地を取得できませんでした。都市名で検索してください。')
  );
});
