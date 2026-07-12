const { loadState, saveState, publicState } = require("./_lib");

// One-time fetch so a freshly loaded page can paint the real current cursor
// position immediately, instead of waiting for the next broadcast (which
// only fires when someone is actively dragging).
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const state = await loadState();
  await saveState(state); // persist on first-ever read so it's stable from here on
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(publicState(state));
};
