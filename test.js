const https = require("https");
const fs = require("fs");

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1520460000898846740/1slkPqhRAdV7D5S45ra7Kl3hK8Livo1FmAw7joU_tfmoVDw45UNAVxRfob-0ZSYXpfwM";
const ROLE_ID = process.env.ROLE_ID || "1520459883135369367";
const STATE_FILE = "state.json";

const FAKE_EVENT = {
  id: "test-fake-event-001",
  name: "Mega Moon",
  type: "moon",
  state: "countdown",
  releaseUnix: Math.floor(Date.now() / 1000) + 300,
  graceEndUnix: Math.floor(Date.now() / 1000) + 600,
  silhouetteAssetId: 93931571035202,
  revealAssetId: 81904298114761,
  descriptionHtml: 'A <font color="#FFD54A">new moon</font> is in <font color="#4CAF50">grow a garden 2</font>... and it is <b><font color="#1E40AF">MEGA!</font></b> Collect <font color="#1E40AF">MEGA</font> seeds that spawn around the map, and grow your garden <font color="#1E40AF">MEGA</font>.',
};

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').trim();
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

async function main() {
  const event = FAKE_EVENT;
  const ts = event.releaseUnix;
  const assetId = event.silhouetteAssetId ?? event.revealAssetId;
  const imageUrl = `https://www.roblox.com/asset-thumbnail/image?assetId=${assetId}&width=512&height=512&format=png`;

  const embed = {
    title: `${event.name} is dropping <t:${ts}:R>`,
    description: stripHtml(event.descriptionHtml),
    color: 0x1e40af,
    fields: [
      { name: "Type", value: event.type, inline: true },
      { name: "Release", value: `<t:${ts}:F>`, inline: true },
    ],
    image: { url: imageUrl },
    footer: { text: "This is an automated message" },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    content: `<@&${ROLE_ID}>`,
    embeds: [embed],
    allowed_mentions: { roles: [ROLE_ID] },
  };

  console.log("Sending test webhook...");
  const res = await postJSON(WEBHOOK_URL, payload);
  if (res.status >= 200 && res.status < 300) {
    console.log("Webhook sent. Check your Discord channel.");
  } else {
    console.error(`Failed (HTTP ${res.status}):`, res.body);
  }

  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    delete state[event.id];
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log("state.json cleaned up.");
  }
}

main().catch(console.error);
