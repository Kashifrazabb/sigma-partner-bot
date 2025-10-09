import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { readFile, writeFile, access } from "fs/promises";
import { config } from "dotenv";

config()

const BOT_TOKEN = process.env.TOKEN;
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
    console.log("inside: "+db)

    console.log("✅ Postback saved:", record);
    res.send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).send("Error");
  }
});

// Telegram bot: respond to Trader ID messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const uid = msg.text.trim();

  const db = await readDB();
  const traderRecords = db.traders.filter((t) => t.trader_id === uid);
  console.log(db)

  if (traderRecords.length === 0) {
    bot.sendMessage(chatId, `
🚫🚫🚫 ID NOT FOUND 🚫🚫🚫

⬇️👇

🌐 CREATE YOUR ACCOUNT NOW: https://broker-qx.pro/sign-up 

💵 DEPOSIT $30 OR MORE
🎁 50% BONUS CODE: SIGMA50

❓ HAVE ANY QUESTIONS? CONTACT US DIRECTLY: @SIGMA50

📈 START TRADING LIKE A PRO TODAY!`);
  } else {
    const totalPayout = traderRecords.reduce((sum, t) => sum + Number(t.payout || 0), 0);
    const lastEvent = traderRecords[traderRecords.length - 1];

    const replyMsg = `
👤 Trader ID: ${uid}
📊 Last Status: ${lastEvent}
💰 Total Payout: ${totalPayout}
🕒 Last Update: ${new Date(lastEvent.time).toLocaleString()}
`;

    bot.sendMessage(chatId, replyMsg);
  }
});

// Start Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
