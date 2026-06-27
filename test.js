/**
 * test.js — sends a fake countdown embed, waits 15s, then edits it to "is out!"
 * Run: node test.js
 */

const https = require("https");

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1520460000898846740/1slkPqhRAdV7D5S45ra7Kl3hK8Livo1FmAw7joU_tfmoVDw45UNAVxRfob-0ZSYXpfwM";
const ROLE_ID = process.env.ROLE_ID || "1520459883135369367";

const FAKE_EVENT = {
  name: "Mega Moon",
  type: "moon",
  releaseUnix: Math.floor(Date.now() / 1000) + 15, // in 15 seconds
  silhouetteAssetId: 93931571035202,
  revealAssetId: 81904298114761,
  descriptionHtml: 'A <font color="#FFD54A">new moon</font> is in <font color="#4CAF50">grow a garden 2</font>... and it is <b><font color="#1E40AF">MEGA!</font></b> Collect seeds that spawn around the map.',
};

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').trim();
}

function fetchJSON(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : require("http");
    lib.get(url, { headers: { "User-Agent": "gag2drop-bot/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function request(method, url, body, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname, path: u.pathname + u.search, method,
          headers: { "Content-Type": "application/json", ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}) }
        }, (res) => {
          let d = ""; res.on("data", (c) => (d += c));
          res.on("end", () => resolve({ status: res.statusCode, body: d }));
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
      });
      return result;
    } catch (err) {
      console.error(`Request failed (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt < retries) await sleep(2000 * attempt);
      else throw err;
    }
  }
}

async function resolveAssetImage(assetId) {
  if (!assetId) return null;
  const data = await fetchJSON(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=512x512&format=Png&isCircular=false`
  );
  return data?.data?.[0]?.imageUrl ?? null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const event = FAKE_EVENT;
  const ts = event.releaseUnix;

  // ── Step 1: send countdown message ──
  console.log("Resolving silhouette image...");
  const silhouetteUrl = await resolveAssetImage(event.silhouetteAssetId);
  console.log("Silhouette URL:", silhouetteUrl ?? "(none)");

  const countdownEmbed = {
    title: `${event.name} is dropping <t:${ts}:R>`,
    description: stripHtml(event.descriptionHtml),
    color: 0x1e40af,
    fields: [
      { name: "Type", value: event.type, inline: true },
      { name: "Release", value: `<t:${ts}:F>`, inline: true },
    ],
    footer: { text: "This is an automated message" },
    timestamp: new Date().toISOString(),
  };
  if (silhouetteUrl) countdownEmbed.thumbnail = { url: silhouetteUrl };

  console.log("Sending countdown message...");
  const res1 = await request("POST", WEBHOOK_URL + "?wait=true", {
    content: `<@&${ROLE_ID}>`,
    embeds: [countdownEmbed],
    allowed_mentions: { roles: [ROLE_ID] },
  });

  if (res1.status < 200 || res1.status >= 300) {
    console.error("Failed to send:", res1.status, res1.body);
    return;
  }

  const messageId = JSON.parse(res1.body).id;
  console.log(`Countdown message sent (ID: ${messageId}). Waiting 15s to edit...`);

  // ── Step 2: wait, then edit to "is out!" ──
  await sleep(15000);

  console.log("Resolving reveal image...");
  const revealUrl = await resolveAssetImage(event.revealAssetId);
  console.log("Reveal URL:", revealUrl ?? "(none)");

  const outEmbed = {
    title: `${event.name} is out!`,
    description: stripHtml(event.descriptionHtml),
    color: 0x1e40af,
    fields: [
      { name: "Type", value: event.type, inline: true },
      { name: "Released", value: `<t:${ts}:F>`, inline: true },
    ],
    footer: { text: "This is an automated message" },
    timestamp: new Date().toISOString(),
  };
  if (revealUrl) outEmbed.thumbnail = { url: revealUrl };

  const res2 = await request("PATCH", `${WEBHOOK_URL}/messages/${messageId}`, {
    embeds: [outEmbed],
  });

  if (res2.status >= 200 && res2.status < 300) {
    console.log("Message edited to 'is out!' successfully.");
  } else {
    console.error("Edit failed:", res2.status, res2.body);
  }
}

main().catch(console.error);
