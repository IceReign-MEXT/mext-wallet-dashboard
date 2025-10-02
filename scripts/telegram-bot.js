import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

// Replace with your Telegram Bot Token
const TELEGRAM_BOT_TOKEN = "7786222469:AAGI5k9mj9FwqjbPWPSADNZtxVsHh231BUM";

// Dashboard API URL (local for now)
const API_URL = "http://localhost:3000/api/add-subscriber";

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// When user starts the bot
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "👋 Welcome to ICEGODS! Send me your wallet to subscribe.");
});

// Listen for wallet addresses
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Very simple ETH or SOL wallet check
  if (text.startsWith("0x") || text.length > 30) {
    try {
      // Add subscriber + auto-generate invoice
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: text,
          plan: "basic",  // or pro
          currency: text.startsWith("0x") ? "ETH" : "SOL",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        bot.sendMessage(chatId, `✅ Subscribed!\nInvoice created:\n\n💵 Amount: ${data.invoice.amount} ${data.invoice.currency}\n📜 Status: ${data.invoice.status}`);
      } else {
        bot.sendMessage(chatId, `❌ Error: ${data.error}`);
      }
    } catch (err) {
      bot.sendMessage(chatId, "⚠️ Could not connect to dashboard API.");
    }
  }
});
