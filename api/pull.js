const {
  pusher,
  CHANNEL,
  HOLD_MS,
  HOLD_RADIUS,
  SPEED,
  PULL_TTL_MS,
  BROADCAST_MIN_GAP_MS,
  BOUND_MIN,
  BOUND_MAX,
  clamp,
  randomTarget,
  loadState,
  saveState,
  publicState,
} = require("./_lib");

// This is the one place the game actually advances: every drag update from
// any client lands here, so it doubles as the physics tick. There's no
// separate always-on ticker process — when nobody is pulling, net force is
// zero and nothing needs to move anyway, so an event-driven step is enough.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { playerId, dx, dy } = req.body || {};
  if (
    typeof playerId !== "string" ||
    !playerId ||
    typeof dx !== "number" ||
    typeof dy !== "number" ||
    !Number.isFinite(dx) ||
    !Number.isFinite(dy)
  ) {
    return res.status(400).json({ error: "bad request" });
  }

  const now = Date.now();
  const state = await loadState();

  state.pulls[playerId] = { dx, dy, ts: now };
  for (const id in state.pulls) {
    if (now - state.pulls[id].ts > PULL_TTL_MS) delete state.pulls[id];
  }

  const dt = Math.min((now - (state.lastTick || now)) / 1000, 0.25);
  state.lastTick = now;

  let fx = 0,
    fy = 0,
    n = 0;
  for (const id in state.pulls) {
    const p = state.pulls[id];
    const len = Math.hypot(p.dx, p.dy);
    if (len < 4) continue; // dead zone, matches the client's own threshold
    fx += p.dx / len;
    fy += p.dy / len;
    n++;
  }
  if (n > 0) {
    fx /= n;
    fy /= n;
    state.cursor.x = clamp(state.cursor.x + fx * SPEED * dt, BOUND_MIN, BOUND_MAX);
    state.cursor.y = clamp(state.cursor.y + fy * SPEED * dt, BOUND_MIN, BOUND_MAX);
  }

  let justCompletedAt = null;
  const dist = Math.hypot(
    state.cursor.x - state.targetBtn.x,
    state.cursor.y - state.targetBtn.y,
  );
  if (dist < HOLD_RADIUS) {
    if (!state.holdStart) state.holdStart = now;
    if (now - state.holdStart >= HOLD_MS) {
      justCompletedAt = { x: state.targetBtn.x, y: state.targetBtn.y };
      state.tasksDone++;
      state.taskNum++;
      state.targetBtn = randomTarget(state.cursor);
      state.holdStart = null;
    }
  } else {
    state.holdStart = null;
  }

  const shouldBroadcast =
    justCompletedAt || now - (state.lastBroadcast || 0) > BROADCAST_MIN_GAP_MS;
  if (shouldBroadcast) state.lastBroadcast = now;

  await saveState(state);

  const payload = publicState(state, justCompletedAt ? { justCompletedAt } : null);

  if (shouldBroadcast) {
    await pusher.trigger(CHANNEL, "state-update", payload);
  }

  res.status(200).json(payload);
};
