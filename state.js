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
