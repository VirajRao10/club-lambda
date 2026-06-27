import html from "./index.html";
import css from "./app-css.txt";
import app from "./app-client.txt";

const PATH_PREFIXES = ["/gamble", "/clublambda"];
const COOKIE_NAME = "club_lambda_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const STARTING_BALANCE = "1000";
const BONUS_INTERVAL_MS = 3_600_000;
const SUPABASE_URL_FALLBACK = "https://naxlamszrokhjgabqjcf.supabase.co";
const SUPABASE_KEY_FALLBACK = "sb_publishable_0nN7horex5x9oTo8X5m5bQ_atkmN6tO";

const HF = {
  readWallet: "5b85cd626f95bb19df360875646671b440977767870a7a04a73cbabd2f9bd88a",
  recordBet: "38d361b90b8956a2ccaa2ff67d8112a8228e4edcb4810f3af3bd5e7252b84aa8",
  claimBonus: "f1bec105ab4f7dd3e86ffab5bd053cf787814b210a53a75db2c22dca5543a5e6",
  setName: "2fb8770049d20b258819d7787f1f7a4dc8e336b6af380282586a8c499dd00c30",
  signOut: "bca3390e1b2e08f639fab93a608349a336a4c6aad2081d77c9b3e7a1e458c4c5",
  linkShoo: "dbd460458231de82d1c15953eb2cf4741a599f0a8b63afe852bf386e813a137d",
  redeemPromo: "910b226994a1f0e6e208ce010335be96c3fba3320c4f3357c12faf2d0dd2a94e"
};

const FONT_NAMES = new Set([
  "Exposure-205TF-VAR.woff2",
  "Exposure-205TF-VAR-Italic.woff2",
  "OpenRunde-Regular.woff2",
  "OpenRunde-Medium.woff2",
  "JetBrainsMono-Variable.woff2"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = PATH_PREFIXES.find((item) => {
      return url.pathname === item || url.pathname.startsWith(`${item}/`);
    });

    if (!prefix) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === `${prefix}/api/health`) {
      return json({ ok: true, route: prefix, time: Date.now() });
    }

    if (url.pathname === `${prefix}/api/leaderboard`) {
      return handleLeaderboard(request, env);
    }

    if (url.pathname.startsWith(`${prefix}/_serverFn/`)) {
      return handleServerFn(request, env, prefix);
    }

    if (url.pathname.startsWith(`${prefix}/fonts/`)) {
      const fontName = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (!FONT_NAMES.has(fontName)) {
        return new Response("Not found", { status: 404 });
      }

      const fontResponse = await fetch(`https://21.community.poke.site/fonts/${fontName}`, {
        cf: { cacheTtl: 86400, cacheEverything: true }
      });

      if (!fontResponse.ok) {
        return new Response("Font unavailable", { status: 502 });
      }

      return new Response(fontResponse.body, {
        headers: {
          "content-type": "font/woff2",
          "cache-control": "public, max-age=86400"
        }
      });
    }

    if (url.pathname === `${prefix}/app.css`) {
      return new Response(css, {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=120"
        }
      });
    }

    if (url.pathname === `${prefix}/app.js`) {
      return new Response(app.replaceAll("__CLUB_LAMBDA_BASE__", prefix), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=120"
        }
      });
    }

    const headers = new Headers({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120"
    });

    headers.set("x-club-lambda-route", prefix);

    return new Response(html.replaceAll("__CLUB_LAMBDA_BASE__", prefix), {
      headers
    });
  }
};

async function handleServerFn(request, env, prefix) {
  const url = new URL(request.url);
  const hash = url.pathname.slice(`${prefix}/_serverFn/`.length);
  const headers = new Headers(corsHeaders(request));
  const uid = await ensureUid(request, headers, env);
  let result;

  try {
    if (request.method === "GET" && hash === HF.readWallet) {
      result = walletToApi(await getOrCreateWallet(env, uid));
    } else if (request.method === "POST" && hash === HF.recordBet) {
      const data = await readData(request);
      result = walletToApi(await recordBet(env, uid, BigInt(data.bet || "0"), BigInt(data.win || "0")));
    } else if (request.method === "POST" && hash === HF.claimBonus) {
      const bonus = await claimBonus(env, uid);
      result = walletToApi(bonus.wallet);
      result.claimed = bonus.claimed;
    } else if (request.method === "POST" && hash === HF.setName) {
      const data = await readData(request);
      result = walletToApi(await setName(env, uid, String(data.name || "")));
    } else if (request.method === "POST" && hash === HF.signOut) {
      result = walletToApi(await resetWallet(env, uid));
    } else if (request.method === "POST" && hash === HF.linkShoo) {
      const data = await readData(request);
      const linked = await linkShoo(env, uid, data);
      if (linked.account && linked.account.uid !== uid) {
        setUidCookie(headers, linked.account.uid);
      }
      result = linked.account
        ? { linked: true, account: walletToApi(linked.account) }
        : { linked: false, reason: linked.reason || "unknown" };
    } else if (request.method === "POST" && hash === HF.redeemPromo) {
      const data = await readData(request);
      result = await redeemPromo(env, uid, String(data.code || ""));
    } else {
      return json({ result: { ok: false, reason: "unknown_function" }, error: true, context: {} }, { status: 404, headers });
    }

    return json({ result, error: true, context: {} }, { headers });
  } catch (error) {
    return json({
      result: { ok: false, reason: error?.message || "server_error" },
      error: true,
      context: {}
    }, { status: 200, headers });
  }
}

async function handleLeaderboard(request, env) {
  const headers = new Headers(corsHeaders(request));
  const uid = await ensureUid(request, headers, env);
  const rows = await sb(env, "/wallets?select=uid,name,balance,biggest_win,hands_played&limit=200");
  const sorted = rows
    .map((row) => ({
      uid: row.uid,
      name: row.name || (row.uid === uid ? "You" : "Lambda guest"),
      balance: row.balance || "0",
      biggestWin: row.biggest_win || "0",
      handsPlayed: row.hands_played || "0",
      you: row.uid === uid
    }))
    .sort((a, b) => compareBigIntDesc(a.balance, b.balance))
    .slice(0, 20);

  return json({ rows: sorted }, { headers });
}

async function ensureUid(request, headers, env) {
  let uid = getUid(request);
  if (!uid) {
    uid = newUid();
    setUidCookie(headers, uid);
  }
  await getOrCreateWallet(env, uid);
  return uid;
}

function getUid(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function setUidCookie(headers, uid) {
  headers.append(
    "set-cookie",
    `${COOKIE_NAME}=${encodeURIComponent(uid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  );
}

function newUid() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readData(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return request.json();
  }
  const text = await request.text();
  if (!text) return {};
  const params = new URLSearchParams(text);
  const raw = params.get("data");
  return raw ? JSON.parse(raw) : Object.fromEntries(params);
}

function walletToApi(w) {
  const lastTopUp = Number(w.last_top_up || 0);
  return {
    uid: w.uid,
    name: w.name || "",
    balance: w.balance || STARTING_BALANCE,
    biggestWin: w.biggest_win || "0",
    totalWagered: w.total_wagered || "0",
    handsPlayed: w.hands_played || "0",
    lastTopUp,
    bonusInMs: lastTopUp === 0 ? 0 : Math.max(0, BONUS_INTERVAL_MS - (Date.now() - lastTopUp)),
    linkedUserId: w.linked_user_id || null
  };
}

async function getWallet(env, uid) {
  const rows = await sb(env, `/wallets?uid=eq.${encodeURIComponent(uid)}&select=*&limit=1`);
  return rows[0] || null;
}

async function createWallet(env, uid) {
  const rows = await sb(env, "/wallets?select=*", {
    method: "POST",
    body: {
      uid,
      name: "",
      balance: STARTING_BALANCE,
      biggest_win: "0",
      total_wagered: "0",
      hands_played: "0",
      last_top_up: 0,
      linked_user_id: null
    },
    prefer: "return=representation"
  });
  return rows[0];
}

async function getOrCreateWallet(env, uid) {
  return (await getWallet(env, uid)) || createWallet(env, uid);
}

async function updateWallet(env, uid, patch) {
  const rows = await sb(env, `/wallets?uid=eq.${encodeURIComponent(uid)}&select=*`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation"
  });
  if (!rows[0]) throw new Error("wallet_not_found");
  return rows[0];
}

async function recordBet(env, uid, bet, win) {
  if (bet < 0n || win < 0n) throw new Error("bad_input");
  const wallet = await getOrCreateWallet(env, uid);
  const balance = BigInt(wallet.balance || STARTING_BALANCE);
  const nextBalance = balance - bet + win;
  if (nextBalance < 0n) throw new Error("insufficient_balance");
  const biggestWin = win > BigInt(wallet.biggest_win || "0") ? win : BigInt(wallet.biggest_win || "0");

  return updateWallet(env, uid, {
    balance: nextBalance.toString(),
    biggest_win: biggestWin.toString(),
    total_wagered: (BigInt(wallet.total_wagered || "0") + bet).toString(),
    hands_played: (BigInt(wallet.hands_played || "0") + 1n).toString()
  });
}

async function claimBonus(env, uid) {
  const wallet = await getOrCreateWallet(env, uid);
  const lastTopUp = Number(wallet.last_top_up || 0);
  if (lastTopUp && Date.now() - lastTopUp < BONUS_INTERVAL_MS) {
    return { wallet, claimed: false };
  }

  const updated = await updateWallet(env, uid, {
    balance: (BigInt(wallet.balance || STARTING_BALANCE) + 200n).toString(),
    last_top_up: Date.now()
  });

  return { wallet: updated, claimed: true };
}

async function setName(env, uid, name) {
  return updateWallet(env, uid, { name: name.trim().slice(0, 18) });
}

async function resetWallet(env, uid) {
  return updateWallet(env, uid, {
    balance: STARTING_BALANCE,
    biggest_win: "0",
    total_wagered: "0",
    hands_played: "0",
    last_top_up: 0,
    name: "",
    linked_user_id: null
  });
}

async function linkShoo(env, currentUid, data) {
  const token = String(data.token || "");
  const userId = String(data.userId || "");
  if (!token || !userId) return { account: null, reason: "no_token" };

  const existingRows = await sb(env, `/wallets?linked_user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  const existing = existingRows[0];
  if (existing) {
    if (existing.uid !== currentUid) {
      const anon = await getWallet(env, currentUid);
      if (anon && !anon.linked_user_id) {
        await updateWallet(env, existing.uid, {
          balance: (BigInt(existing.balance || "0") + BigInt(anon.balance || "0")).toString()
        });
        await sb(env, `/wallets?uid=eq.${encodeURIComponent(currentUid)}`, { method: "DELETE" });
      }
    }
    return { account: await getWallet(env, existing.uid) };
  }

  return { account: await updateWallet(env, currentUid, { linked_user_id: userId }) };
}

async function redeemPromo(env, uid, code) {
  const normalized = code.trim().toUpperCase();
  const wallet = await getOrCreateWallet(env, uid);
  const balance = wallet.balance || STARTING_BALANCE;
  if (!normalized) return { ok: false, reason: "empty", balance };

  const promos = await sb(env, `/promo_codes?code=eq.${encodeURIComponent(normalized)}&select=*&limit=1`);
  const promo = promos[0];
  if (!promo || Number(promo.uses || 0) >= Number(promo.max_uses || 1)) {
    return { ok: false, reason: "invalid", balance };
  }

  const existing = await sb(env, `/promo_redemptions?uid=eq.${encodeURIComponent(uid)}&code=eq.${encodeURIComponent(normalized)}&select=uid&limit=1`);
  if (existing[0]) return { ok: false, reason: "already_claimed", balance };

  try {
    await sb(env, "/promo_redemptions", {
      method: "POST",
      body: { uid, code: normalized },
      prefer: "return=minimal"
    });
  } catch (error) {
    if (String(error.message || "").includes("409")) {
      return { ok: false, reason: "already_claimed", balance };
    }
    throw error;
  }

  const nextBalance = (BigInt(balance) + BigInt(promo.reward)).toString();
  await updateWallet(env, uid, { balance: nextBalance });
  await sb(env, `/promo_codes?code=eq.${encodeURIComponent(normalized)}`, {
    method: "PATCH",
    body: { uses: Number(promo.uses || 0) + 1 },
    prefer: "return=minimal"
  });

  return { ok: true, reward: promo.reward, blurb: promo.blurb, balance: nextBalance };
}

async function sb(env, path, options = {}) {
  const baseUrl = env.SUPABASE_URL || SUPABASE_URL_FALLBACK;
  const key = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || SUPABASE_KEY_FALLBACK;
  const headers = new Headers({
    apikey: key,
    authorization: `Bearer ${key}`,
    accept: "application/json"
  });

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.prefer) {
    headers.set("prefer", options.prefer);
  }

  const response = await fetch(`${baseUrl}/rest/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    throw new Error(`supabase_${response.status}`);
  }

  if (response.status === 204 || options.prefer === "return=minimal") {
    return [];
  }

  return response.json();
}

function compareBigIntDesc(a, b) {
  const left = BigInt(a || "0");
  const right = BigInt(b || "0");
  return left === right ? 0 : left > right ? -1 : 1;
}

function json(value, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { ...init, headers });
}

function corsHeaders(request) {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  }
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, accept, x-tsr-serverfn, x-tsr-serverFn");
  return headers;
}
