/**
 * Локальный / простой хостинг-эндпоинт для формы → Telegram.
 *
 * Запуск:
 *   node server.mjs
 *   node server.mjs --get-chat-id   # после /start боту — узнать chat_id
 *
 * Секреты только из .env (не из браузера).
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getChatId() {
  if (!TOKEN) {
    console.error("Нет TELEGRAM_BOT_TOKEN в .env");
    process.exit(1);
  }
  const data = await tg("getUpdates", { limit: 20 });
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
    console.log("Обновлений нет. Напиши боту /start в Telegram и запусти снова:");
    console.log("  node server.mjs --get-chat-id");
    process.exit(0);
  }
  console.log("Найденные chat_id — скопируй свой в .env как TELEGRAM_CHAT_ID:\n");
  for (const [id, chat] of chats) {
    const name = [chat.first_name, chat.last_name, chat.username ? `@${chat.username}` : ""]
      .filter(Boolean)
      .join(" ");
    console.log(`  ${id}  ${name}`);
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64_000) {
        reject(new Error("Слишком большой запрос"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleLead(req, res) {
  if (!TOKEN || !CHAT_ID) {
    sendJson(res, 500, {
      ok: false,
      error: "Сервер не настроен: нужен TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env",
    });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { ok: false, error: "Некорректный JSON" });
    return;
  }

  const name = String(payload.name || "").trim().slice(0, 120);
  const contact = String(payload.contact || "").trim().slice(0, 200);
  const topic = String(payload.topic || "").trim().slice(0, 40);
  const message = String(payload.message || "").trim().slice(0, 2000);

  if (!message || message.length < 5) {
    sendJson(res, 400, { ok: false, error: "Напишите вопрос или описание (хотя бы несколько слов)" });
    return;
  }

  const topicLabel =
    { A: "Вариант A — управленческий вопрос", B: "Вариант B — разбор отчёта", C: "Вариант C — консультация", "": "Без варианта" }[
      topic
    ] || topic;

  const text = [
    "🆕 Заявка с сайта",
    "",
    `Вариант: ${topicLabel}`,
    `Имя: ${name || "—"}`,
    `Контакт: ${contact || "—"}`,
    "",
    "Сообщение:",
    message,
  ].join("\n");

  const data = await tg("sendMessage", {
    chat_id: CHAT_ID,
    text,
    disable_web_page_preview: true,
  });

  if (!data.ok) {
    console.error("Telegram sendMessage failed:", data);
    sendJson(res, 502, { ok: false, error: "Не удалось отправить в Telegram" });
    return;
  }

  sendJson(res, 200, { ok: true });
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
  if (req.method === "OPTIONS" && req.url === "/api/lead") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "POST" && req.url === "/api/lead") {
    try {
      await handleLead(req, res);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { ok: false, error: "Ошибка сервера" });
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
