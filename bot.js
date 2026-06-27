const https = require("https");
const fs = require("fs");
 
const API_URL = "https://gag.gg/api/events";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ROLE_ID = process.env.ROLE_ID || "1520459883135369367";
const STATE_FILE = "state.json";
 
function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { "User-Agent": "gag2drop-bot/1.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on("error", (e) => { console.error(e.message); resolve(null); });
  });
}
 
function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    req.write(payload); req.end();
  });
}
 
function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}
 
function colorForType(type) {
  return { moon: 0x1e40af, meteor: 0xff6b35 }[type] ?? 0x5865f2;
}
 
async function sendAlert(event) {
  const desc = stripHtml(event.descriptionHtml);
  const ts = event.releaseUnix > 1e12 ? Math.floor(event.releaseUnix / 1000) : event.releaseUnix;
  const assetId = event.silhouetteAssetId ?? event.revealAssetId;
  const imageUrl = assetId
    ? `https://www.roblox.com/asset-thumbnail/image?assetId=${assetId}&width=512&height=512&format=png`
    : null;
 
  const embed = {
    title: `${event.name} is dropping <t:${ts}:R>`,
    description: desc || "*(no description)*",
    color: colorForType(event.type),
    fields: [
      { name: "Type", value: event.type ?? "unknown", inline: true },
      { name: "Release", value: `<t:${ts}:F>`, inline: true },
    ],
    footer: { text: "This is an automated message" },
    timestamp: new Date().toISOString(),
  };
  if (imageUrl) embed.image = { url: imageUrl };
 
  const payload = {
    content: `<@&${ROLE_ID}>`,
    embeds: [embed],
    allowed_mentions: { roles: [ROLE_ID] },
  };
 
  const res = await postJSON(WEBHOOK_URL, payload);
  if (res.status >= 200 && res.status < 300) {
    console.log(`Webhook sent: "${event.name}"`);
  } else {
    console.error(`Webhook failed ${res.status}: ${res.body}`);
  }
}
 
async function main() {
  if (!WEBHOOK_URL) { console.error("WEBHOOK_URL missing"); process.exit(1); }
 
  let prevState = {};
  if (fs.existsSync(STATE_FILE)) {
    try { prevState = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
    catch { prevState = {}; }
  }
 
  const data = await fetchJSON(API_URL);
  if (!data?.events) { console.error("Invalid API response"); process.exit(1); }
 
  const newState = {};
  const isFirstRun = Object.keys(prevState).length === 0;
 
  for (const event of data.events) {
    const { id, state } = event;
    newState[id] = state;
 
    if (!(id in prevState)) {
      if (!isFirstRun) {
        await sendAlert(event);
      } else {
        console.log(`[init] ${event.name} -> ${state}`);
      }
    } else if (prevState[id] !== state) {
      await sendAlert(event);
    } else {
      console.log(`[=] ${event.name} -> ${state} (no change)`);
    }
  }
 
  fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
  console.log("Done.");
}
 
main().catch((e) => { console.error(e); process.exit(1); });
