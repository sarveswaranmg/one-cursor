const { pusher, CHANNEL, loadState, saveState, publicState } = require("./_lib");

// Called on pointerup so a released drag disappears immediately instead of
// waiting out the pull's TTL — purely a responsiveness nicety.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { playerId } = req.body || {};
  if (typeof playerId !== "string" || !playerId) {
    return res.status(400).json({ error: "bad request" });
  }

  const state = await loadState();
  if (state.pulls[playerId]) {
    delete state.pulls[playerId];
    await saveState(state);
    await pusher.trigger(CHANNEL, "state-update", publicState(state));
  }
  res.status(200).end();
};
