/**
 * Общая логика заявки → Telegram (Cloudflare Worker и совместимые среды).
 * Секреты: env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
    payload = await request.json();
  } catch {
    return json(400, { ok: false, error: "Некорректный JSON" });
  }

  const name = String(payload.name || "").trim().slice(0, 120);
  const contact = String(payload.contact || "").trim().slice(0, 200);
  const topic = String(payload.topic || "").trim().slice(0, 40);
  const message = String(payload.message || "").trim().slice(0, 2000);

  if (!contact) {
    return json(400, { ok: false, error: "Укажите контакт — Telegram, телефон или email." });
  }
  if (!message || message.length < 5) {
    return json(400, {
      ok: false,
      error: "Напишите вопрос или описание (хотя бы несколько слов)",
    });
  }

  const topicLabel =
    {
      A: "Вариант A — управленческий вопрос",
      B: "Вариант B — разбор отчёта",
      C: "Вариант C — консультация",
      "": "Без варианта",
    }[topic] || topic;

  const text = [
    "🆕 Заявка с сайта",
    "",
    `Вариант: ${topicLabel}`,
    `Имя: ${name || "—"}`,
    `Контакт: ${contact}`,
    "",
    "Сообщение:",
    message,
  ].join("\n");

  const data = await tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });

  if (!data.ok) {
    console.error("Telegram sendMessage failed:", data);
    return json(502, { ok: false, error: "Не удалось отправить в Telegram" });
  }

  return json(200, { ok: true });
}
