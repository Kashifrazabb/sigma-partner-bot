import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { readFile, writeFile, access } from "fs/promises";
import { config } from "dotenv";

config()

const BOT_TOKEN = process.env.TOKEN;
const CHANNEL_ID = -1002216197397
const PORT = 5000;
const DB_FILE = "data.json";

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

// Initialize Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Initialize Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  const uid = msg.text.trim();

  // Ignore commands starting with '/'
  if (uid.startsWith("/") || !/^\d+$/.test(uid)) return;

  const db = await readDB();
  const traderRecord = db.traders.filter((t) => t.trader_id === uid);

  if (traderRecord.length === 0) {
    bot.sendMessage(chatId, `
🚫🚫🚫 ID NOT FOUND 🚫🚫🚫

⬇️👇

🌐 CREATE YOUR ACCOUNT NOW: https://market-qx.trade/sign-up/?lid=1123026 

💵 DEPOSIT $30 OR MORE
🎁 50% BONUS CODE: SIGMA50

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Sigma_Quotex_Trader

📈 START TRADING LIKE A PRO TODAY!`);
  }
  else {
    const totalPayout = traderRecord.reduce((sum, t) => sum + Number(t.payout || 0), 0);
    const lastEvent = traderRecord[traderRecord.length - 1];
    var replyMsg = "";
    if (totalPayout >= 20 && lastEvent.status == "ftd") {
      const invite = await bot.createChatInviteLink(CHANNEL_ID, {
        name: `Invite for ${uid}`,
        expire_date: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
        member_limit: 1, // one-time link
      });
      replyMsg = `
  CONGRATULATIONS 🎉🍾 YOUR ID IS VERIFIED ✅
  LINK TO MY SVIP: ${invite.invite_link}

  ❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Sigma_Quotex_Trader
  📈 START TRADING LIKE A PRO TODAY!
      `
    }
    else if (totalPayout > 1 && totalPayout < 20 && lastEvent.status == "ftd") {
      replyMsg = `
      ✅✅✅ ACCOUNT CREATED ✅✅✅
      
  YOUR DEPOSITED ${totalPayout} THAT IS LESS THAN 30$. PLEASE DEPOSIT THE REQUIRED AMOUNT ❤️

  ❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Sigma_Quotex_Trader
  📈 START TRADING LIKE A PRO TODAY!
      `
    }
    else {
      replyMsg = `
      ✅✅✅ ACCOUNT CREATED ✅✅✅
      
   PLEASE DEPOSIT THE REQUIRED AMOUNT TO JOIN SIGMA VIP (SVIP) ❤️

  ❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @Sigma_Quotex_Trader
  📈 START TRADING LIKE A PRO TODAY!
      `
    };
    bot.sendMessage(chatId, replyMsg);
  }
});

// Start Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
