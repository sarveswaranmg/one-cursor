# ONE CURSOR

A single-page web game / social experiment: everyone who opens the page shares
control of **one cursor**. No one player can move it alone — every drag is a
real vote, summed with everyone else currently dragging, and the cursor
drifts toward the net direction. The shared goal: steer it onto a target and
hold it there for 2 seconds — while total strangers, and at least a few
trolls, actively fight you for it.

This is now a **real, live multiplayer product** — every visitor connects to
the same authoritative game state. There is no simulated crowd; if only one
person is on the page, the game is genuinely just that one person (plus
whoever else happens to open the page at the same time).

The target button's copy is deliberately unhinged and rotates every task —
"PRESS ME, COWARD," "UNLOCK SIGMA MODE," "L + RATIO IF YOU MISS," and two
dozen other gen-z-bait one-liners (see `TARGET_LABELS` in `api/_lib.js`) —
on purpose, to be the kind of thing people scream-share into a group chat.
Same idea for the completion toast (`CELEBRATIONS` in `index.html`), which
throws a different absurd victory line every time a task gets completed.

## Architecture

Everything is serverless, built to run on **Vercel**:

```
one-cursor/
├── index.html          — the game (markup + CSS + client JS)
├── api/
│   ├── _lib.js          — shared constants + Redis/Pusher clients
│   ├── config.js        — GET  → public Pusher key/cluster for the client
│   ├── pusher-auth.js   — POST → signs presence-channel subscriptions
│   ├── state.js         — GET  → current canonical game state (initial paint)
│   ├── pull.js          — POST → a player's drag vector; this IS the physics tick
│   └── release.js       — POST → clears a player's pull immediately on release
├── package.json
└── .env.example
```

**Why this shape:** Vercel serverless functions are stateless and short-lived
— they can't run a persistent `setInterval` game loop the way the original
local prototype did. So the design moves the tick *into* the request that
already has to happen anyway:

- **State** (cursor position, target button, task count, everyone's current
  pull vector) lives in **Upstash Redis** (added from the Vercel dashboard's
  Storage tab), not in any one server process's memory.
- Every time a client calls `POST /api/pull` (throttled to ~10/sec while
  actively dragging), that request reads the current state, advances the
  physics by however much time passed, checks for task completion, writes
  the new state back, and — rate-capped to avoid flooding — broadcasts it.
- **Pusher Channels** does the fan-out: one `presence-one-cursor` channel
  that every client subscribes to. Presence membership also gives an exact
  live "N online" count for free, no extra bookkeeping needed.
- When nobody is dragging, net force is zero, so nothing needs to advance —
  an event-driven tick is enough; there's no gap versus a real always-on
  ticker.
- The client never computes game physics or decides "task complete" itself
  — it only renders whatever the server last broadcast, smoothing the
  cursor's position between updates so motion still looks continuous even
  though broadcasts land every ~100ms rather than every frame.

## Deploying it (one-time setup)

You'll need two free accounts beyond Vercel — Pusher owns the realtime
fan-out, Upstash owns the shared state. Neither can be created on your
behalf; each is a short signup + copy some keys into Vercel.

1. **Pusher** — create a free app at https://dashboard.pusher.com (Channels
   product). Copy `app_id`, `key`, `secret`, `cluster`.
2. **Upstash Redis** — in your Vercel project dashboard, go to **Storage →
   Create Database → Upstash → Redis** (a few clicks, no separate signup
   needed — it links through Vercel). This sets `KV_REST_API_URL` /
   `KV_REST_API_TOKEN` automatically.
3. In the Vercel project's **Settings → Environment Variables**, add the four
   Pusher values from step 1 (`PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`,
   `PUSHER_CLUSTER`). See `.env.example` for the full list.
4. Deploy:
   ```
   npx vercel        # first run: logs you into Vercel, links/creates the project
   npx vercel --prod # ship it live
   ```
   (Or connect the GitHub repo in the Vercel dashboard for auto-deploy on
   push — no CLI needed either way.)

That's it — no separate backend to run, nothing to keep alive yourself.

## How to play

- **Anywhere on screen:** press and drag — you're pulling against everyone
  else currently connected.
- **Mobile:** works the same via touch.
- Steer the glowing cursor onto the target (button copy changes every
  round — good luck) and keep it there for 2 seconds to complete the task.
  A new task (new spot, new trolling label) spawns immediately after, for
  everyone.
- Tap the ⓘ icons to learn more about the concept and the rules.
- The small dot bottom-right shows real connection status: *connecting…*,
  *live*, or *reconnecting…*.

## Background color = crowd mood

Unchanged from the original design — the page background is a live blend of
everyone's current pull direction (left → red, right → blue, up → green,
down → violet), with saturation reflecting how much consensus there is.

## Known limitations / what to harden if it takes off

- **Pusher free tier** caps at 200k messages/day and 100 concurrent
  connections. The broadcast rate is capped server-side
  (`BROADCAST_MIN_GAP_MS` in `api/_lib.js`) to stretch that quota, but a
  genuinely viral moment would need a paid Pusher plan.
- **No anti-abuse rate limiting** on `/api/pull` beyond the broadcast cap —
  fine for a fun community project, not hardened against a deliberate flood.
- **Task-completion race**: two requests landing in the same few
  milliseconds right at the 2-second mark could theoretically both see
  "not yet complete" and both then complete it. Low-stakes for this game
  (worst case: a task is skipped or double-counted once in a while), not
  worth a distributed lock for v1.
- Dark theme only, by design.
