import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { readFile, writeFile, access } from "fs/promises";
import { config } from "dotenv";
import path from 'path';

config()

const BOT_TOKEN = process.env.TOKEN;
const SVIP_ID = -1002216197397;
const COMPOUNDING_ID = -1003492565712;
const PORT = 5000;
const DB_FILE = "data.json";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://sigma-partner-bot.onrender.com";

// Helper functions for JSON file storage
async function readDB() {
  try {
    await access(DB_FILE);
    const data = await readFile(DB_FILE, "utf-8");
    return JSON.parse(data || '{"traders":[]}');
  } catch {
    return { traders: [] };
  }
}

async function writeDB(data) {
  await writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set the webhook for Telegram
const webhookPath = `/bot${BOT_TOKEN}`;
const webhookURL = `${WEBHOOK_URL}${webhookPath}`;
await bot.setWebHook(webhookURL);

console.log(`✅ Webhook set to: ${webhookURL}`);

// Handle Telegram updates
app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/download', (req, res) => {
  const filePath = path.join(path.resolve(), 'data.json');
  res.download(filePath, 'data.json', (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).send('Error downloading file');
    }
  });
});

// Quotex postback endpoint
app.all("/sigmapostback", async (req, res) => {
  try {
    const data = req.method === "GET" ? req.query : req.body;
    const record = {
      trader_id: data.uid || "N/A",
      click_id: data.cid || "N/A",
      status: data.status || "unknown",
      payout: data.payout || "0",
      event_id: data.eid || "N/A",
      site_id: data.sid || "N/A",
      landing_id: data.lid || "N/A",
      time: new Date().toISOString(),
    };

    const db = await readDB();
    db.traders.push(record);
    await writeDB(db);

    console.log("✅ Postback saved:", record);
    res.send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).send("Error");
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Send me your trader ID to verify.');
});

// Telegram bot: respond to Trader ID messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const uid = msg.text?.trim();

  // Ignore commands starting with '/' or non-digit messages
  if (!uid || uid.startsWith("/") || !/^\d+$/.test(uid)) return;

  const db = await readDB();
  const traderRecord = db.traders.filter((t) => t.trader_id === uid);

  if (traderRecord.length === 0) {
    bot.sendMessage(chatId, `
🚫🚫 ID NOT FOUND 🚫🚫

⬇️👇⬇️👇⬇️👇⬇️👇

🌐 CREATE YOUR ACCOUNT NOW: https://market-qx.trade/sign-up/?lid=1123026 

💵 DEPOSIT $10 OR MORE
🎁 50% BONUS CODE: SIGMA50

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Teamrealsigma

📈 START TRADING LIKE A PRO TODAY!`);
    return;
  }

  const totalPayout = traderRecord.reduce((sum, t) => sum + Number(t.payout || 0), 0);
  var replyMsg = "";

  const firstRecord = traderRecord[0];

  if (!firstRecord.invite_svip || !firstRecord.invite_comp) {
    if (!firstRecord.invite_svip) {
      const invite_svip = await bot.createChatInviteLink(SVIP_ID, {
        name: `Invite for ${uid}`,
        expire_date: 0,
        member_limit: 1,
      });
      firstRecord.invite_svip = invite_svip.invite_link;
    }

    if (!firstRecord.invite_comp) {
      const invite_comp = await bot.createChatInviteLink(COMPOUNDING_ID, {
        name: `Invite for ${uid}`,
        expire_date: 0,
        member_limit: 1,
      });
      firstRecord.invite_comp = invite_comp.invite_link;
    }

    await writeDB(db);
  }

  // Build reply message based on totalPayout and stored links
  if (totalPayout >= 10 && totalPayout < 30) {
    replyMsg = `
CONGRATULATIONS 🎉🍾 YOUR ID IS VERIFIED ✅
YOUR DEPOSIT: ${totalPayout}$ 💵💰

1️⃣ LINK TO MY SVIP: ${firstRecord.invite_svip} 💚

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Teamrealsigma
📈 START TRADING LIKE A PRO TODAY!`;
  } else if (totalPayout >= 30) {
    replyMsg = `
CONGRATULATIONS 🎉🍾 YOUR ID IS VERIFIED ✅
YOUR DEPOSIT: ${totalPayout}$ 💵💰

1️⃣ LINK TO MY SVIP: ${firstRecord.invite_svip} 💚
2️⃣ LINK TO MY COMPOUNDING: ${firstRecord.invite_comp} 💛

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Teamrealsigma
📈 START TRADING LIKE A PRO TODAY!`;
  } else if (totalPayout > 1 && totalPayout < 10) {
    replyMsg = `
✅✅✅ ACCOUNT CREATED ✅✅✅

YOUR DEPOSITED ${totalPayout}$ THAT IS LESS THAN 10$. PLEASE DEPOSIT THE REQUIRED AMOUNT ❤️

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Teamrealsigma
📈 START TRADING LIKE A PRO TODAY!`;
  } else {
    replyMsg = `
✅✅✅ ACCOUNT CREATED ✅✅✅

PLEASE DEPOSIT THE REQUIRED AMOUNT TO JOIN SIGMA VIP (SVIP) ❤️

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Teamrealsigma
📈 START TRADING LIKE A PRO TODAY!`;
  }

  bot.sendMessage(chatId, replyMsg);
});


// Start Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
