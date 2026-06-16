// Cloudflare Worker: Tor-Push-Backend fuer die WM-2026-App.
//
// Aufgaben:
//  1) Abos verwalten (Frontend meldet Push-Subscription + ausgewaehlte Spiele).
//  2) Per Cron (jede Minute) die offizielle FIFA-API pollen, Tore in beobachteten
//     Spielen erkennen und betroffene Abonnenten per Web-Push "wecken".
//  3) /pending liefert dem Service Worker die anzuzeigenden Tor-Meldungen.
//
// Bindings (siehe wrangler.toml): KV "PUSH".
// Secrets:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url), VAPID_SUBJECT (mailto:...).

const FIFA_URL = "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=de&count=200";
const WORKER_VERSION = "kv-index-v2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// --- base64url Helpers ---
const b64urlToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytesToB64url = (bytes) => {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const strToB64url = (s) => bytesToB64url(new TextEncoder().encode(s));

const hashEndpoint = async (endpoint) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return bytesToB64url(digest);
};

// --- VAPID (ES256) ---
let vapidKeyPromise = null;
const getVapidKey = (env) => {
  if (!vapidKeyPromise) {
    const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY); // 65 Bytes: 0x04 || X(32) || Y(32)
    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: env.VAPID_PRIVATE_KEY,
      ext: true,
    };
    vapidKeyPromise = crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  return vapidKeyPromise;
};

const vapidAuthHeader = async (env, audience) => {
  const header = strToB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = strToB64url(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:admin@example.com" }));
  const unsigned = `${header}.${body}`;
  const key = await getVapidKey(env);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
};

// Payloadloser Web-Push: weckt nur den Service Worker, der dann /pending abholt.
const sendWake = async (env, subscription) => {
  const audience = new URL(subscription.endpoint).origin;
  const auth = await vapidAuthHeader(env, audience);
  return fetch(subscription.endpoint, { method: "POST", headers: { Authorization: auth, TTL: "120", "Content-Length": "0" } });
};

// --- KV Zugriff ---
const SUB_INDEX_KEY = "sub:index";
const getSub = (env, hash) => env.PUSH.get(`sub:${hash}`, "json");
const putSub = (env, hash, value) => env.PUSH.put(`sub:${hash}`, JSON.stringify(value));
const getSubIndex = async (env) => {
  const value = await env.PUSH.get(SUB_INDEX_KEY, "json");
  return Array.isArray(value) ? value.filter((hash) => typeof hash === "string") : [];
};
const putSubIndex = (env, hashes) => env.PUSH.put(SUB_INDEX_KEY, JSON.stringify([...new Set(hashes)]));
const addSubToIndex = async (env, hash) => {
  const hashes = await getSubIndex(env);
  if (!hashes.includes(hash)) await putSubIndex(env, [...hashes, hash]);
};
const removeSubFromIndex = async (env, hash) => {
  const hashes = await getSubIndex(env);
  if (hashes.includes(hash)) await putSubIndex(env, hashes.filter((item) => item !== hash));
};
const delSub = async (env, hash) => {
  await Promise.all([env.PUSH.delete(`sub:${hash}`), env.PUSH.delete(`pending:${hash}`)]);
  await removeSubFromIndex(env, hash);
};

// --- HTTP-Endpunkte ---
async function handleRequest(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/subscribe") {
    const { subscription } = await request.json();
    if (!subscription?.endpoint) return json({ error: "subscription fehlt" }, 400);
    const hash = await hashEndpoint(subscription.endpoint);
    const existing = (await getSub(env, hash)) || {};
    await putSub(env, hash, { subscription, matchIds: existing.matchIds || [], updatedAt: Date.now() });
    await addSubToIndex(env, hash);
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/matches") {
    const { endpoint, matchIds } = await request.json();
    if (!endpoint) return json({ error: "endpoint fehlt" }, 400);
    const hash = await hashEndpoint(endpoint);
    const existing = await getSub(env, hash);
    if (!existing) return json({ error: "unbekanntes Abo" }, 404);
    await putSub(env, hash, { ...existing, matchIds: Array.isArray(matchIds) ? matchIds : [], updatedAt: Date.now() });
    await addSubToIndex(env, hash);
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/unsubscribe") {
    const { endpoint } = await request.json();
    if (endpoint) await delSub(env, await hashEndpoint(endpoint));
    return json({ ok: true });
  }

  if (request.method === "GET" && url.pathname === "/pending") {
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return json([]);
    const hash = await hashEndpoint(endpoint);
    const pending = (await env.PUSH.get(`pending:${hash}`, "json")) || [];
    await env.PUSH.delete(`pending:${hash}`); // einmalig ausliefern
    return json(pending);
  }

  // Test: schickt allen angemeldeten Geraeten sofort eine Test-Push (zum Pruefen der Zustellung).
  if (url.pathname === "/test") {
    let pushed = 0;
    let subscribers = 0;
    const hashes = await getSubIndex(env);
    for (const hash of hashes) {
      const entry = await getSub(env, hash);
      if (!entry?.subscription) {
        await removeSubFromIndex(env, hash);
        continue;
      }
      subscribers += 1;
      const queue = (await env.PUSH.get(`pending:${hash}`, "json")) || [];
      queue.push({ title: "Test Push", body: "Push funktioniert! Du wirst bei Toren benachrichtigt.", url: "/wm-2026-companion/" });
      await env.PUSH.put(`pending:${hash}`, JSON.stringify(queue), { expirationTtl: 60 * 30 });
      try {
        const r = await sendWake(env, entry.subscription);
        if (r.status === 404 || r.status === 410) await delSub(env, hash);
        else pushed += 1;
      } catch {
        // ignorieren
      }
    }
    return json({ ok: true, subscribers, pushed });
  }
  if (url.pathname === "/" || url.pathname === "/status") return json({ ok: true, service: "wm-goal-push", version: WORKER_VERSION });
  return json({ error: "not found" }, 404);
}

// --- Spieldetail: Torschuetze ermitteln ---
const localizedDesc = (arr) => (arr && arr[0] && arr[0].Description) || "";
const goalMinuteValue = (m) => {
  const p = (m || "").match(/\d+/g) || [];
  return Number(p[0] || 0) + Number(p[1] || 0) / 10;
};
async function fetchMatchDetail(stageId, matchId) {
  const url = `https://api.fifa.com/api/v3/live/football/17/285023/${stageId}/${matchId}?language=de`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, cf: { cacheTtl: 0 } });
  if (!res.ok) return null;
  return res.json();
}
// Letztes Tor einer Seite + Torschuetze. Eigentor: Schuetze steht im Gegner-Kader (FIFA-Typ 3).
function latestGoal(detail, side) {
  const team = side === "home" ? detail.HomeTeam : detail.AwayTeam;
  const other = side === "home" ? detail.AwayTeam : detail.HomeTeam;
  const goals = (team && team.Goals) || [];
  if (goals.length === 0) return null;
  const g = goals.slice().sort((a, b) => goalMinuteValue(b.Minute) - goalMinuteValue(a.Minute))[0];
  const own = ((team && team.Players) || []).find((p) => p.IdPlayer === g.IdPlayer);
  const opp = ((other && other.Players) || []).find((p) => p.IdPlayer === g.IdPlayer);
  const player = own || opp;
  const name = player ? localizedDesc(player.ShortName) || localizedDesc(player.PlayerName) : "";
  const isOwnGoal = g.Type === 3 || (!!opp && !own);
  const isPenalty = g.Type === 4;
  return { name, minute: g.Minute || "", isOwnGoal, isPenalty };
}

// --- Cron: Tore erkennen & Push senden ---
async function checkGoals(env) {
  // 1) Alle Abos sammeln, beobachtete Spiele -> Abonnenten-Map.
  const matchSubs = new Map(); // matchId -> [{hash, subscription}]
  const hashes = await getSubIndex(env);
  for (const hash of hashes) {
    const entry = await getSub(env, hash);
    if (!entry?.subscription) {
      await removeSubFromIndex(env, hash);
      continue;
    }
    for (const matchId of entry.matchIds || []) {
      if (!matchSubs.has(matchId)) matchSubs.set(matchId, []);
      matchSubs.get(matchId).push({ hash, subscription: entry.subscription });
    }
  }
  if (matchSubs.size === 0) return;

  // 2) Aktuelle FIFA-Staende holen.
  const res = await fetch(FIFA_URL, { headers: { Accept: "application/json" }, cf: { cacheTtl: 0 } });
  if (!res.ok) return;
  const data = await res.json();
  const wakes = new Map(); // hash -> subscription (einmal pro Abo wecken)

  for (const item of data.Results || []) {
    const matchId = `match-${String(item.MatchNumber).padStart(3, "0")}`;
    const subs = matchSubs.get(matchId);
    if (!subs) continue;

    const status = item.MatchStatus; // 0 beendet, 1 geplant, 3 live
    if (status !== 0 && status !== 3) continue;
    const h = item.HomeTeamScore ?? item.Home?.Score ?? 0;
    const a = item.AwayTeamScore ?? item.Away?.Score ?? 0;
    const home = item.Home?.TeamName?.[0]?.Description || item.Home?.Abbreviation || "Heim";
    const away = item.Away?.TeamName?.[0]?.Description || item.Away?.Abbreviation || "Gast";

    const prevRaw = await env.PUSH.get(`score:${matchId}`);
    const prev = prevRaw ? prevRaw.split(":").map(Number) : null;
    await env.PUSH.put(`score:${matchId}`, `${h}:${a}`, { expirationTtl: 60 * 60 * 6 });

    // Beim ersten Sehen nur Basislinie setzen (keine Falsch-Tore).
    if (!prev) continue;
    const [ph, pa] = prev;
    if (h <= ph && a <= pa) continue;

    // Spieldetail laden, um den Torschuetzen zu nennen (nur wenn ein Tor fiel).
    let detail = null;
    if (item.IdStage && item.IdMatch) {
      try {
        detail = await fetchMatchDetail(item.IdStage, item.IdMatch);
      } catch {
        // ohne Detail wird nur das Team genannt
      }
    }

    const sides = [];
    if (h > ph) sides.push({ side: "home", team: home });
    if (a > pa) sides.push({ side: "away", team: away });

    const messages = sides.map(({ side, team }) => {
      const g = detail ? latestGoal(detail, side) : null;
      let body;
      if (g && g.name) {
        const min = g.minute ? ` (${g.minute})` : "";
        body = g.isOwnGoal ? `Eigentor: ${g.name}${min}` : `${g.name} trifft!${min}${g.isPenalty ? " - Elfmeter" : ""}`;
      } else {
        body = `${team} trifft!`;
      }
      return { title: `Tor: ${home} ${h}:${a} ${away}`, body, tag: matchId, url: "/wm-2026-companion/" };
    });

    for (const { hash } of subs) {
      const key = `pending:${hash}`;
      const queue = (await env.PUSH.get(key, "json")) || [];
      for (const message of messages) queue.push(message);
      await env.PUSH.put(key, JSON.stringify(queue), { expirationTtl: 60 * 30 });
      wakes.set(hash, subs.find((s) => s.hash === hash).subscription);
    }
  }

  // 3) Betroffene Abos wecken; abgelaufene aufraeumen.
  for (const [hash, subscription] of wakes) {
    try {
      const r = await sendWake(env, subscription);
      if (r.status === 404 || r.status === 410) await delSub(env, hash);
    } catch {
      // einzelnen Push-Fehler ignorieren
    }
  }
}

export default {
  fetch: handleRequest,
  scheduled: (_event, env, ctx) => ctx.waitUntil(checkGoals(env)),
};

