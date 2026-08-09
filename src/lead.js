/**
 * Общая логика заявки → Telegram (Cloudflare Worker и совместимые среды).
 * Секреты: env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID
 * Принимает JSON или multipart/form-data (поле file).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  "xlsx",
  "xls",
  "xlsm",
  "csv",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "zip",
]);

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function topicLabel(topic) {
  return (
    {
      A: "Вариант A — управленческий вопрос",
      B: "Вариант B — разбор отчёта",
      C: "Вариант C — консультация",
      "": "Без варианта",
    }[topic] || topic
  );
}

function buildCaption({ name, contact, topic, message, fileName }) {
  const lines = [
    "🆕 Заявка с сайта",
    "",
    `Вариант: ${topicLabel(topic)}`,
    `Имя: ${name || "—"}`,
    `Контакт: ${contact}`,
  ];
  if (fileName) lines.push(`Файл: ${fileName}`);
  lines.push("", "Сообщение:", message || "—");
  return lines.join("\n");
}

function extOf(name) {
  const i = String(name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function parsePayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const hasFile = file && typeof file === "object" && typeof file.size === "number" && file.size > 0;
    return {
      name: String(form.get("name") || "").trim().slice(0, 120),
      contact: String(form.get("contact") || "").trim().slice(0, 200),
      topic: String(form.get("topic") || "").trim().slice(0, 40),
      message: String(form.get("message") || "").trim().slice(0, 2000),
      file: hasFile ? file : null,
    };
  }

  const payload = await request.json();
  return {
    name: String(payload.name || "").trim().slice(0, 120),
    contact: String(payload.contact || "").trim().slice(0, 200),
    topic: String(payload.topic || "").trim().slice(0, 40),
    message: String(payload.message || "").trim().slice(0, 2000),
    file: null,
  };
}

async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

async function sendTelegramDocument(token, chatId, file, caption) {
  const body = new FormData();
  body.append("chat_id", chatId);
  body.append("caption", caption.slice(0, 1024));
  body.append("document", file, file.name || "file");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body,
  });
  return res.json();
}

export async function handleLead(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const token = env.TELEGRAM_BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || "";

  if (!token || !chatId) {
    return json(500, {
      ok: false,
      error: "Сервер не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в Secrets",
    });
  }

  let payload;
  try {
    payload = await parsePayload(request);
  } catch {
    return json(400, { ok: false, error: "Некорректные данные формы" });
  }

  if (!payload.contact) {
    return json(400, { ok: false, error: "Укажите контакт — Telegram, телефон или email." });
  }

  const hasFile = Boolean(payload.file);
  if (!hasFile && payload.message.length < 5) {
    return json(400, {
      ok: false,
      error: "Напишите сообщение или прикрепите файл отчёта",
    });
  }

  if (hasFile) {
    if (payload.file.size > MAX_FILE_BYTES) {
      return json(400, { ok: false, error: "Файл слишком большой — максимум 10 МБ" });
    }
    const ext = extOf(payload.file.name);
    if (!ALLOWED_EXT.has(ext)) {
      return json(400, {
        ok: false,
        error: "Допустимы: Excel, CSV, PDF, JPG/PNG или ZIP",
      });
    }
  }

  const text = buildCaption({
    name: payload.name,
    contact: payload.contact,
    topic: payload.topic,
    message: payload.message,
    fileName: hasFile ? payload.file.name : "",
  });

  let data;
  if (hasFile) {
    data = await sendTelegramDocument(token, chatId, payload.file, text);
    if (data.ok && text.length > 1024) {
      await sendTelegramMessage(token, chatId, text);
    }
  } else {
    data = await sendTelegramMessage(token, chatId, text);
  }

  if (!data.ok) {
    console.error("Telegram send failed:", data);
    return json(502, { ok: false, error: "Не удалось отправить в Telegram" });
  }

  return json(200, { ok: true });
}
