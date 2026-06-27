const https = require("https");
const fs = require("fs");

const API_URL = "https://gag.gg/api/events";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ROLE_ID = process.env.ROLE_ID || "1520459883135369367";
const STATE_FILE = "state.json";


function fetchJSON(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : require("http");
    lib.get(url, { headers: { "User-Agent": "gag2drop-bot/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on("error", (e) => { console.error(e.message); resolve(null); });
  });
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (payload) opts.headers["Content-Length"] = Buffer.byteLength(payload);
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function resolveAssetImage(assetId) {
  if (!assetId) return null;
  const data = await fetchJSON(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=512x512&format=Png&isCircular=false`
  );
  return data?.data?.[0]?.imageUrl ?? null;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .trim();
}

function colorForType(type) {
  return { moon: 0x1e40af, meteor: 0xff6b35 }[type] ?? 0x5865f2;
}

async function buildCountdownPayload(event) {
  const ts = event.releaseUnix > 1e12 ? Math.floor(event.releaseUnix / 1000) : event.releaseUnix;
  const imageUrl = await resolveAssetImage(event.silhouetteAssetId ?? event.revealAssetId);

  const embed = {
    title: `${event.name} is dropping <t:${ts}:R>`,
    description: stripHtml(event.descriptionHtml) || "*(no description)*",
    color: colorForType(event.type),
    fields: [
      { name: "Type", value: event.type ?? "unknown", inline: true },
      { name: "Release", value: `<t:${ts}:F>`, inline: true },
    ],
    footer: { text: "This is an automated message" },
    timestamp: new Date().toISOString(),
  };
  if (imageUrl) embed.thumbnail = { url: imageUrl };

  return {
    content: `<@&${ROLE_ID}>`,
    embeds: [embed],
    allowed_mentions: { roles: [ROLE_ID] },
  };
}

async function buildOutPayload(event) {
  const ts = event.releaseUnix > 1e12 ? Math.floor(event.releaseUnix / 1000) : event.releaseUnix;
  const imageUrl = await resolveAssetImage(event.revealAssetId);

  const embed = {
    title: `${event.name} is out!`,
    description: stripHtml(event.descriptionHtml) || "*(no description)*",
    color: colorForType(event.type),
    fields: [
      { name: "Type", value: event.type ?? "unknown", inline: true },
      { name: "Released", value: `<t:${ts}:F>`, inline: true },
    ],
    footer: { text: "This is an automated message" },
    timestamp: new Date().toISOString(),
  };
  if (imageUrl) embed.thumbnail = { url: imageUrl };

  return { embeds: [embed] };
}


async function sendMessage(payload) {
  const res = await request("POST", WEBHOOK_URL + "?wait=true", payload);
  if (res.status >= 200 && res.status < 300) {
    const msg = JSON.parse(res.body);
    console.log(`Webhook sent, message ID: ${msg.id}`);
    return msg.id;
  } else {
    console.error(`Webhook POST failed ${res.status}: ${res.body}`);
    return null;
  }
}

async function editMessage(messageId, payload) {
  const url = WEBHOOK_URL + `/messages/${messageId}`;
  const res = await request("PATCH", url, payload);
  if (res.status >= 200 && res.status < 300) {
    console.log(`Message ${messageId} edited.`);
  } else {
    console.error(`Webhook PATCH failed ${res.status}: ${res.body}`);
  }
}


function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return {}; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  if (!WEBHOOK_URL) { console.error("WEBHOOK_URL missing"); process.exit(1); }

  const prevState = loadState();
  const data = await fetchJSON(API_URL);
  if (!data?.events) { console.error("Invalid API response"); process.exit(1); }

  const newState = { ...prevState };
  const isFirstRun = Object.keys(prevState).length === 0;
  const now = Math.floor(Date.now() / 1000);

  for (const event of data.events) {
    const { id } = event;
    const ts = event.releaseUnix > 1e12 ? Math.floor(event.releaseUnix / 1000) : event.releaseUnix;
    const isLive = now >= ts;
    const prev = prevState[id];

    if (!prev) {
      if (isFirstRun) {
        newState[id] = { state: event.state, messageId: null, live: isLive };
        console.log(`[init] ${event.name} -> ${event.state} (live: ${isLive})`);
        continue;
      }

      const payload = await buildCountdownPayload(event);
      const messageId = await sendMessage(payload);
      newState[id] = { state: event.state, messageId, live: false };

    } else {
      const wasLive = prev.live ?? false;

      if (!wasLive && isLive) {
        if (prev.messageId) {
          const payload = await buildOutPayload(event);
          await editMessage(prev.messageId, payload);
        }
        newState[id] = { ...prev, live: true };

      } else if (prev.state !== event.state && !isLive) {

        if (!prev.messageId) {
          const payload = await buildCountdownPayload(event);
          const messageId = await sendMessage(payload);
          newState[id] = { state: event.state, messageId, live: false };
        } else {
          newState[id] = { ...prev, state: event.state };
        }

      } else {
        console.log(`[=] ${event.name} (no change)`);
      }
    }
  }

  saveState(newState);
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
