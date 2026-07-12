const { pusher } = require("./_lib");

// Presence-channel auth endpoint. pusher-js POSTs socket_id + channel_name
// here before a client is allowed to join "presence-one-cursor"; we sign the
// request and assign the client's own playerId as its presence user_id so
// the "N online" count and pull map line up with the same id everywhere.
module.exports = function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { socket_id, channel_name, playerId } = req.body || {};
  if (!socket_id || !channel_name) {
    return res.status(400).json({ error: "missing socket_id/channel_name" });
  }
  const userId =
    typeof playerId === "string" && playerId.length > 0
      ? playerId
      : Math.random().toString(36).slice(2);
  const auth = pusher.authorizeChannel(socket_id, channel_name, {
    user_id: userId,
    user_info: {},
  });
  res.status(200).json(auth);
};
