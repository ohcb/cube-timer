const WCA_EVENTS = [
  ['333','3x3'],
  ['222','2x2'],
  ['444','4x4'],
  ['555','5x5'],
  ['666','6x6'],
  ['777','7x7'],
  ['333oh','3x3 OH'],
  ['333bf','3x3 BLD'],
  ['minx','Megaminx'],
  ['pyram','Pyraminx'],
  ['skewb','Skewb'],
  ['sq1','Square-1'],
  ['clock','Clock']
];

const STORAGE_KEY = 'cube-timer-timer-first-state-v2';
const READY_DELAY_MS = 700;

const $ = (selector) => document.querySelector(selector);

const elements = {
  app: $('#app'),
  timerZone: $('#timerZone'),
  timerDisplay: $('#timerDisplay'),
  timerState: $('#timerState'),
  timerHelp: $('#timerHelp'),
  eventSelect: $('#eventSelect'),
  sessionSelect: $('#sessionSelect'),
  newSessionButton: $('#newSessionButton'),
  newScrambleButton: $('#newScrambleButton'),
  scrambleText: $('#scrambleText'),
  pbSingle: $('#pbSingle'),
  pbAo5: $('#pbAo5'),
  ao5: $('#ao5'),
  ao12: $('#ao12'),
  ao50: $('#ao50'),
  ao100: $('#ao100'),
  solveCount: $('#solveCount'),
  historyList: $('#historyList'),
  trendCanvas: $('#trendCanvas'),
  distributionBars: $('#distributionBars')
};

const createId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

const createSession = (name, eventId) => ({
  id: createId('session'),
  name,
  eventId,
  createdAt: Date.now(),
  solves: []
});

const defaultSession = createSession('Main Session', '333');

let state = loadState() || {
  activeEventId: '333',
  activeSessionId: defaultSession.id,
  sessions: {
    [defaultSession.id]: defaultSession
  },
  currentScramble: ''
};

let mode = 'idle';
let startAt = 0;
let raf = 0;
let readyTimer = 0;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeSession() {
  return state.sessions[state.activeSessionId];
}

function sessionSolves() {
  return activeSession().solves.filter((solve) => solve.eventId === state.activeEventId);
}

function solvedTime(solve) {
  if (solve.penalty === 'DNF') return null;
  return solve.timeMs + (solve.penalty === '+2' ? 2000 : 0);
}

function formatTime(ms) {
  if (ms == null || Number.isNaN(ms)) return '-';
  const total = ms / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0
    ? `${minutes}:${seconds.toFixed(2).padStart(5,'0')}`
    : seconds.toFixed(2);
}

function displaySolve(solve) {
  if (solve.penalty === 'DNF') return 'DNF';
  const base = formatTime(solvedTime(solve));
  return solve.penalty === '+2' ? `${base}+` : base;
}

function averageOf(solves, windowSize) {
  const window = solves.slice(0, windowSize);
  if (window.length < windowSize) return null;

  const values = window.map(solvedTime);
  const dnfCount = values.filter((time) => time == null).length;

  if (dnfCount > 1) return null;

  const finite = values
    .filter((time) => time != null)
    .sort((a, b) => a - b);

  if (dnfCount === 1) {
    finite.shift();
  } else {
    finite.shift();
    finite.pop();
  }

  return Math.round(
    finite.reduce((sum, time) => sum + time, 0) / finite.length
  );
}

function bestAverage(solves, windowSize) {
  let best = null;

  for (let start = 0; start + windowSize <= solves.length; start += 1) {
    const average = averageOf(solves.slice(start), windowSize);

    if (average != null && (best == null || average < best)) {
      best = average;
    }
  }

  return best;
}

function eventSolves(eventId) {
  return Object.values(state.sessions)
    .flatMap((session) => session.solves)
    .filter((solve) => solve.eventId === eventId);
}

function calculateEventPb(eventId) {
  const solves = eventSolves(eventId);
  const singles = solves
    .map(solvedTime)
    .filter((time) => time != null);

  return {
    singleMs: singles.length ? Math.min(...singles) : null,
    ao5Ms: bestAverage(solves, 5),
    ao12Ms: bestAverage(solves, 12),
    ao50Ms: bestAverage(solves, 50),
    ao100Ms: bestAverage(solves, 100)
  };
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateSequence(moves, length, avoidSameAxis = true) {
  const scramble = [];
  let lastAxis = '';

  while (scramble.length < length) {
    const move = randomChoice(moves);
    const axis = move.replace(/[w2'()\/\s-]/g, '')[0];

    if (avoidSameAxis && axis === lastAxis) continue;

    lastAxis = axis;
    scramble.push(`${move}${randomChoice(['', "'", '2'])}`);
  }

  return scramble.join(' ');
}

function generateScramble(eventId) {
  if (eventId === '222') {
    return generateSequence(['R', 'U', 'F'], 11);
  }

  if (eventId === '444') {
    return generateSequence(['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Uw', 'Fw'], 40);
  }

  if (eventId === '555' || eventId === '666' || eventId === '777') {
    return generateSequence(
      ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
      eventId === '555' ? 60 : 80
    );
  }

  if (eventId === '333oh' || eventId === '333bf') {
    return generateSequence(['R', 'L', 'U', 'D', 'F', 'B'], 25);
  }

  if (eventId === 'pyram') {
    return generateSequence(['R', 'L', 'U', 'B', 'r', 'l', 'u', 'b'], 12, false);
  }

  if (eventId === 'skewb') {
    return generateSequence(['R', 'L', 'U', 'B'], 11, false);
  }

  if (eventId === 'minx') {
    return Array.from(
      { length: 7 },
      () => `${randomChoice(['R++','R--'])} ${randomChoice(['D++','D--'])}`
    ).join(' ') + ` ${randomChoice(['U', "U'"])}`;
  }

  if (eventId === 'sq1') {
    return Array.from(
      { length: 12 },
      () => `(${Math.floor(Math.random() * 7) - 3},${Math.floor(Math.random() * 7) - 3}) /`
    ).join(' ');
  }

  if (eventId === 'clock') {
    return Array.from(
      { length: 14 },
      () =>
        randomChoice(['UR','DR','DL','UL','U','R','D','L','ALL']) +
        randomChoice(['0+','1+','2+','3+','4+','5+','1-','2-','3-','4-','5-'])
    ).join(' ');
  }

  return generateSequence(['R', 'L', 'U', 'D', 'F', 'B'], 25);
}

function setMode(nextMode) {
  mode = nextMode;
  elements.timerZone.className = `timer-zone ${nextMode}`;
  elements.timerState.textContent = nextMode.toUpperCase();

  elements.timerHelp.textContent =
    nextMode === 'ready'
      ? 'READY... 곧 시작합니다.'
      : nextMode === 'running'
        ? '클릭 또는 Space로 정지'
        : '클릭하면 READY, 잠시 후 자동 시작됩니다. 실행 중 클릭하면 정지합니다.';
}

function enterReady() {
  if (mode !== 'idle') return;

  setMode('ready');
  clearTimeout(readyTimer);
  readyTimer = setTimeout(startTimer, READY_DELAY_MS);
}

function startTimer() {
  if (mode !== 'ready') return;

  startAt = performance.now();
  setMode('running');
  tick();
}

function tick() {
  elements.timerDisplay.textContent =
    formatTime(Math.round(performance.now() - startAt));

  if (mode === 'running') {
    raf = requestAnimationFrame(tick);
  }
}

function stopTimer() {
  if (mode !== 'running') return;

  const timeMs = Math.round(performance.now() - startAt);

  cancelAnimationFrame(raf);
  setMode('idle');
  elements.timerDisplay.textContent = formatTime(timeMs);

  activeSession().solves.unshift({
    id: createId('solve'),
    eventId: state.activeEventId,
    sessionId: state.activeSessionId,
    timeMs,
    penalty: null,
    scramble: state.currentScramble,
    createdAt: Date.now()
  });

  state.currentScramble = generateScramble(state.activeEventId);
  persistAndRender();
}

function cancelReadyOrReset() {
  clearTimeout(readyTimer);
  cancelAnimationFrame(raf);
  setMode('idle');
  elements.timerDisplay.textContent = '0.00';
}

function handleTimerTrigger() {
  if (mode === 'idle') enterReady();
  else if (mode === 'running') stopTimer();
}

function renderOptions() {
  elements.eventSelect.innerHTML = WCA_EVENTS
    .map(([id, label]) => `<option value="${id}">${label}</option>`)
    .join('');

  elements.sessionSelect.innerHTML = Object.values(state.sessions)
    .map((session) => `<option value="${session.id}">${session.name}</option>`)
    .join('');
}

function drawTrend(solves) {
  const canvas = elements.trendCanvas;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  ctx.fillRect(0, 0, w, h);

  const points = solves
    .map(solvedTime)
    .filter((time) => time != null)
    .slice(0, 50)
    .reverse();

  if (points.length < 2) {
    ctx.fillStyle = '#95a0bf';
    ctx.font = '18px system-ui';
    ctx.fillText('기록 2개 이상부터 그래프가 표시됩니다.', 28, 125);
    return;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);

  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1;

  for (let i = 1; i <= 3; i += 1) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(w - 24, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#27d99b';
  ctx.lineWidth = 4;
  ctx.beginPath();

  points.forEach((time, index) => {
    const x = 28 + (index / (points.length - 1)) * (w - 56);
    const y = h - 28 - ((time - min) / Math.max(max - min, 1)) * (h - 56);

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  points.forEach((time, index) => {
    const x = 28 + (index / (points.length - 1)) * (w - 56);
    const y = h - 28 - ((time - min) / Math.max(max - min, 1)) * (h - 56);

    ctx.fillStyle = '#f3f6ff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderDistribution(solves) {
  elements.distributionBars.innerHTML = '';

  const values = solves
    .map(solvedTime)
    .filter((time) => time != null);

  if (!values.length) {
    elements.distributionBars.innerHTML =
      '<p class="empty">기록이 쌓이면 분포가 표시됩니다.</p>';
    return;
  }

  const bucketSize = 5000;
  const buckets = new Map();

  values.forEach((time) => {
    const start = Math.floor(time / bucketSize) * bucketSize;
    buckets.set(start, (buckets.get(start) || 0) + 1);
  });

  const max = Math.max(...buckets.values());

  [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([start, count]) => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = `
        <span>${formatTime(start)}~${formatTime(start + bucketSize)}</span>
        <span class="bar-track">
          <span class="bar-fill" style="width:${(count / max) * 100}%"></span>
        </span>
        <strong>${count}</strong>
      `;
      elements.distributionBars.append(row);
    });
}

function renderHistory(solves) {
  elements.historyList.innerHTML = '';
  elements.solveCount.textContent = `(${solves.length})`;

  if (!solves.length) {
    elements.historyList.innerHTML =
      '<li class="empty">아직 기록이 없습니다.</li>';
    return;
  }

  solves.forEach((solve, index) => {
    const item = document.createElement('li');

    item.innerHTML = `
      <span>#${solves.length - index}</span>
      <span class="history-time">${displaySolve(solve)}</span>
      <span class="history-meta" title="${solve.scramble}">
        ${solve.penalty || 'OK'} · ${solve.scramble}
      </span>
      <span class="mini-actions">
        <button data-action="plus2" data-id="${solve.id}" class="warning">+2</button>
        <button data-action="dnf" data-id="${solve.id}" class="danger">DNF</button>
        <button data-action="clear" data-id="${solve.id}">OK</button>
        <button data-action="delete" data-id="${solve.id}" class="danger">삭제</button>
      </span>
    `;

    elements.historyList.append(item);
  });
}

function render() {
  const solves = sessionSolves();
  const pb = calculateEventPb(state.activeEventId);

  elements.eventSelect.value = state.activeEventId;
  elements.sessionSelect.value = state.activeSessionId;
  elements.scrambleText.textContent = state.currentScramble;

  elements.pbSingle.textContent = formatTime(pb.singleMs);
  elements.pbAo5.textContent = formatTime(pb.ao5Ms);

  elements.ao5.textContent = formatTime(averageOf(solves, 5));
  elements.ao12.textContent = formatTime(averageOf(solves, 12));
  elements.ao50.textContent = formatTime(averageOf(solves, 50));
  elements.ao100.textContent = formatTime(averageOf(solves, 100));

  renderHistory(solves);
  drawTrend(solves);
  renderDistribution(solves);
}

function persistAndRender() {
  renderOptions();
  saveState();
  render();
}

function updateSolve(id, action) {
  const solve = activeSession().solves.find((item) => item.id === id);

  if (!solve) return;

  if (action === 'delete') {
    activeSession().solves =
      activeSession().solves.filter((item) => item.id !== id);
  }

  if (action === 'plus2') {
    solve.penalty = solve.penalty === '+2' ? null : '+2';
  }

  if (action === 'dnf') {
    solve.penalty = solve.penalty === 'DNF' ? null : 'DNF';
  }

  if (action === 'clear') {
    solve.penalty = null;
  }

  persistAndRender();
}

function shouldIgnoreTimer(event) {
  return Boolean(
    event.target.closest('[data-ignore-timer],button,select,a,input,textarea')
  );
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (!shouldIgnoreTimer(event)) {
      handleTimerTrigger();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      handleTimerTrigger();
    }

    if (event.code === 'Escape') {
      cancelReadyOrReset();
    }
  });

  elements.eventSelect.addEventListener('change', (event) => {
    state.activeEventId = event.target.value;
    activeSession().eventId = state.activeEventId;
    state.currentScramble = generateScramble(state.activeEventId);
    persistAndRender();
  });

  elements.sessionSelect.addEventListener('change', (event) => {
    state.activeSessionId = event.target.value;
    state.activeEventId = activeSession().eventId;
    state.currentScramble = generateScramble(state.activeEventId);
    persistAndRender();
  });

  elements.newSessionButton.addEventListener('click', () => {
    const name = prompt(
      '새 세션 이름을 입력하세요.',
      `Session ${Object.keys(state.sessions).length + 1}`
    );

    if (!name) return;

    const session = createSession(name, state.activeEventId);
    state.sessions[session.id] = session;
    state.activeSessionId = session.id;

    persistAndRender();
  });

  elements.newScrambleButton.addEventListener('click', () => {
    state.currentScramble = generateScramble(state.activeEventId);
    persistAndRender();
  });

  elements.historyList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');

    if (!button) return;

    updateSolve(button.dataset.id, button.dataset.action);
  });
}

function initialize() {
  renderOptions();
  bindEvents();

  if (!state.currentScramble) {
    state.currentScramble = generateScramble(state.activeEventId);
  }

  setMode('idle');
  persistAndRender();
}

initialize();
