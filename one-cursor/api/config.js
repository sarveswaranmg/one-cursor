// Public Pusher app key + cluster (these are meant to be public, like a
// Stripe "publishable key" — the secret key never leaves the server).
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({
    key: process.env.PUSHER_KEY,
    cluster: process.env.PUSHER_CLUSTER,
  });
};
