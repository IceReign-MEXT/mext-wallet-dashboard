import "dotenv/config";
import fs from "fs";
import path from "path";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

const invoicesFile = path.resolve(process.env.INVOICES_FILE);
const subscribersFile = path.resolve(process.env.SUBSCRIBERS_FILE);

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// ETH + USDT
const ethProvider = new ethers.JsonRpcProvider(
  `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
);

// SOL
const solConnection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

async function checkBalances() {
  let invoices = JSON.parse(fs.readFileSync(invoicesFile, "utf8"));
  let updated = false;

  for (let inv of invoices) {
    if (inv.paid) continue;

    try {
      if (inv.type === "ETH" || inv.type === "USDT") {
        const balance = await ethProvider.getBalance(inv.to);
        const ethBalance = parseFloat(ethers.formatEther(balance));
        if (ethBalance >= parseFloat(inv.price)) {
          inv.paid = true;
          updated = true;
          bot.sendMessage(
            process.env.TELEGRAM_CHANNEL_ID,
            `✅ Invoice ${inv.id} paid with ${inv.type}`
          );
        }
      }

      if (inv.type === "SOL") {
        const solBalance =
          (await solConnection.getBalance(new PublicKey(inv.to))) / 1e9;
        if (solBalance >= parseFloat(inv.price)) {
          inv.paid = true;
          updated = true;
          bot.sendMessage(
            process.env.TELEGRAM_CHANNEL_ID,
            `✅ Invoice ${inv.id} paid with SOL`
          );
        }
      }
    } catch (err) {
      console.error("Error checking invoice", inv.id, err.message);
    }
  }

  if (updated) {
    fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  }
}

setInterval(checkBalances, 30000); // check every 30s

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to ICEGODS! Send me your wallet to subscribe."
  );
});
