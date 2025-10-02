import fs from "fs";
import path from "path";

const subsPath = path.join(process.cwd(), "data", "subscribers.json");

export default function handler(req, res) {
  if (req.method === "GET") {
    try {
      const subscribers = JSON.parse(fs.readFileSync(subsPath, "utf-8"));
      res.status(200).json({ subscribers });
    } catch (err) {
      res.status(500).json({ error: "Failed to read subscribers" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
