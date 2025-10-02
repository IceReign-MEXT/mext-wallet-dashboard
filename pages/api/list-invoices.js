import fs from "fs";
import path from "path";

const invoicesPath = path.join(process.cwd(), "data", "invoices.json");

export default function handler(req, res) {
  if (req.method === "GET") {
    try {
      const invoices = JSON.parse(fs.readFileSync(invoicesPath, "utf-8"));
      res.status(200).json({ invoices });
    } catch (err) {
      res.status(500).json({ error: "Failed to read invoices" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
