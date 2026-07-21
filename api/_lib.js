const { Redis } = require("@upstash/redis");
const Pusher = require("pusher");

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

const CHANNEL = "presence-one-cursor";
const STATE_KEY = "one-cursor:state";

const HOLD_MS = 2000;
const HOLD_RADIUS = 0.05; // normalized [0,1] space
const SPEED = 0.16; // normalized units/sec at full consensus
// Pull vectors arrive in the same normalized [0,1] space the cursor lives in
// (the client divides its pixel drag by viewport width/height before posting),
// so a diagonal drag stays diagonal instead of being skewed by aspect ratio.
const DEAD_ZONE = 0.02; // shorter than this is a twitch, not a vote
const FULL_PULL = 0.1; // at/above this a drag counts as a whole vote
const PULL_TTL_MS = 900; // a pull vector not refreshed within this long is dropped
const BROADCAST_MIN_GAP_MS = 110; // caps fan-out rate regardless of player count
const BOUND_MIN = 0.03;
const BOUND_MAX = 0.97;

// Trolling / gen-z bait button copy — a new one is picked (server-side, so
// everyone sees the same one) every time a new target spawns. Keep entries
// short-ish so the pill button doesn't wrap awkwardly on mobile.
const TARGET_LABELS = [
  "PRESS ME, COWARD",
  "SEND IT",
  "NO CAP, CLICK IT",
  "BE THE MAIN CHARACTER",
  "PROVE YOU'RE NOT AN NPC",
  "CATCH THIS DUB",
  "UNLOCK SIGMA MODE",
  "IT'S GIVING CLICK ME",
  "CERTIFIED HIT BUTTON",
  "CHAOS BUTTON",
  "AURA +1000",
  "MANIFEST THIS CLICK",
  "TOUCH THIS, NOT GRASS",
  "BUSSIN BUTTON, FR",
  "L + RATIO IF YOU MISS",
  "BE FR RIGHT NOW",
  "MID IF YOU DON'T CLICK",
  "UNDERSTOOD THE ASSIGNMENT",
  "COOKED IF WE MISS THIS",
  "THIS IS SO REAL",
  "GOATED TARGET",
  "GLAZE THIS BUTTON",
  "DELULU IS THE SOLULU",
  "GIGACHAD MOVE ONLY",
  "RATIO THIS BUTTON",
  "SIGMA GRINDSET: CLICK",
  "ICK IF YOU MISS",
  "SLAY THE TARGET",
  "ZERO RIZZ IF YOU MISS",
  "PICK ME... NO, CLICK ME",
];

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function randomLabel() {
  return TARGET_LABELS[(Math.random() * TARGET_LABELS.length) | 0];
}

function randomTarget(cursor) {
  let p,
    tries = 0;
  do {
    p = { x: 0.14 + Math.random() * 0.72, y: 0.2 + Math.random() * 0.6 };
    tries++;
  } while (
    tries < 20 &&
    Math.hypot(p.x - cursor.x, p.y - cursor.y) < 0.3
  );
  return { x: p.x, y: p.y, label: randomLabel() };
}

function freshState() {
  const cursor = { x: 0.5, y: 0.5 };
  return {
    cursor,
    targetBtn: randomTarget(cursor),
    taskNum: 1,
    tasksDone: 0,
    holdStart: null,
    lastTick: Date.now(),
    lastBroadcast: 0,
    pulls: {},
  };
}

async function loadState() {
  const state = await redis.get(STATE_KEY);
  return state || freshState();
}

async function saveState(state) {
  await redis.set(STATE_KEY, state);
}

function publicState(state, extra) {
  const pulls = {};
  for (const id in state.pulls) {
    pulls[id] = { dx: state.pulls[id].dx, dy: state.pulls[id].dy };
  }
  return Object.assign(
    {
      cursor: state.cursor,
      targetBtn: state.targetBtn,
      taskNum: state.taskNum,
      tasksDone: state.tasksDone,
      holdStart: state.holdStart,
      pulls,
    },
    extra || {},
  );
}

module.exports = {
  redis,
  pusher,
  CHANNEL,
  HOLD_MS,
  HOLD_RADIUS,
  SPEED,
  DEAD_ZONE,
  FULL_PULL,
  PULL_TTL_MS,
  BROADCAST_MIN_GAP_MS,
  BOUND_MIN,
  BOUND_MAX,
  clamp,
  randomTarget,
  freshState,
  loadState,
  saveState,
  publicState,
};
