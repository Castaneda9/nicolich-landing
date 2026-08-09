/**
 * Локальный сервер: статика из public/ + POST /api/lead → Telegram.
 *
 *   node server.mjs
 *   node server.mjs --get-chat-id
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleLead } from "./src/lead.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function getChatId() {
  if (!TOKEN) {
    console.error("Нет TELEGRAM_BOT_TOKEN в .env");
    process.exit(1);
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 20 }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram error:", data);
    process.exit(1);
  }
  const chats = new Map();
  for (const u of data.result || []) {
    const chat = u.message?.chat || u.my_chat_member?.chat;
    if (chat) chats.set(String(chat.id), chat);
  }
  if (!chats.size) {
    console.log("Обновлений нет. Напиши боту /start и запусти снова:");
    console.log("  node server.mjs --get-chat-id");
    process.exit(0);
  }
  console.log("Найденные chat_id — впиши в .env как TELEGRAM_CHAT_ID:\n");
  for (const [id, chat] of chats) {
    const name = [chat.first_name, chat.last_name, chat.username ? `@${chat.username}` : ""]
      .filter(Boolean)
      .join(" ");
    console.log(`  ${id}  ${name}`);
  }
}

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) {
        reject(new Error("Слишком большой запрос"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safe);

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

if (process.argv.includes("--get-chat-id")) {
  await getChatId();
  process.exit(0);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath === "/api/lead" && (req.method === "POST" || req.method === "OPTIONS")) {
    try {
      const buf = req.method === "POST" ? await readBodyBuffer(req) : undefined;
      const headers = {};
      if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
      const request = new Request("http://localhost/api/lead", {
        method: req.method,
        headers,
        body: buf,
      });
      const out = await handleLead(request, {
        TELEGRAM_BOT_TOKEN: TOKEN,
        TELEGRAM_CHAT_ID: CHAT_ID,
      });
      const text = await out.text();
      const outHeaders = { "Content-Type": out.headers.get("Content-Type") || "application/json" };
      for (const key of ["Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers"]) {
        if (out.headers.get(key)) outHeaders[key] = out.headers.get(key);
      }
      res.writeHead(out.status, outHeaders);
      res.end(text);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Ошибка сервера" }));
    }
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Сайт:  http://localhost:${PORT}`);
  console.log(`Форма: POST http://localhost:${PORT}/api/lead`);
  if (!CHAT_ID) {
    console.log("\n⚠ TELEGRAM_CHAT_ID пуст. Напиши боту /start, затем:");
    console.log("  node server.mjs --get-chat-id");
  }
});
