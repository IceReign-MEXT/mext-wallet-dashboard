import fs from "fs";
import path from "path";

const subscribersPath = path.join(process.cwd(), "data", "subscribers.json");
const invoicesPath = path.join(process.cwd(), "data", "invoices.json");

// Wallets
const ETH_WALLET = "0x08D171685e51bAf7a929cE8945CF25b3D1Ac9756";
const SOL_WALLET = "3JqvK1ZAt67nipBVgZj6zWvuT8icMWBMWyu5AwYnhVss";

export default function handler(req, res) {
  if (req.method === "POST") {
    const { wallet, plan, currency } = req.body;

    if (!wallet || !plan || !currency) {
      return res.status(400).json({ error: "Wallet, plan, and currency required" });
    }

    // Save subscriber
    const subscribers = JSON.parse(fs.readFileSync(subscribersPath, "utf-8"));
    const newSubscriber = {
      id: Date.now(),
      wallet,
      plan,
      status: "active",
      joined: new Date().toISOString(),
    };
    subscribers.push(newSubscriber);
    fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2));

    // Auto-generate invoice
    const invoices = JSON.parse(fs.readFileSync(invoicesPath, "utf-8"));
    const newInvoice = {
      id: Date.now(),
      amount: plan === "pro" ? 50 : 10, // Example: pro=$50, basic=$10
      currency,
      status: "pending",
      wallet: currency === "ETH" ? ETH_WALLET : SOL_WALLET,
      created: new Date().toISOString(),
      subscriber: wallet,
    };
    invoices.push(newInvoice);
    fs.writeFileSync(invoicesPath, JSON.stringify(invoices, null, 2));

    res.status(201).json({ subscriber: newSubscriber, invoice: newInvoice });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
