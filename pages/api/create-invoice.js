import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type } = req.body;
  if (!["ETH", "USDT", "SOL"].includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  const invoicesFile = path.join(process.cwd(), process.env.INVOICES_FILE);
  const invoices = JSON.parse(fs.readFileSync(invoicesFile, "utf8"));

  const id = uuidv4();
  let price = 0;
  let to = "";

  if (type === "ETH") {
    price = process.env.SUBSCRIPTION_PRICE_ETH;
    to = process.env.ETH_WALLET;
  }
  if (type === "USDT") {
    price = process.env.SUBSCRIPTION_PRICE_USDT;
    to = process.env.ETH_WALLET; // same ETH wallet
  }
  if (type === "SOL") {
    price = process.env.SUBSCRIPTION_PRICE_SOL;
    to = process.env.SOL_WALLET;
  }

  const invoice = { id, type, price, to, created: Date.now(), paid: false };
  invoices.push(invoice);

  fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));

  res.status(200).json(invoice);
}
