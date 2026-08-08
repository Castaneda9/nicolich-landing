# Визитка + форма → Telegram

Токен бота и `chat_id` хранятся только в `.env` (в git не попадает).

## Первый запуск

1. Скопируй `.env.example` → `.env` (если ещё нет) и вставь токен бота.
2. В Telegram открой своего бота и нажми **Start** / напиши `/start`.
3. Узнай свой `chat_id`:

```bash
cd marketing/site
node server.mjs --get-chat-id
```

4. Впиши число в `.env`:

```
TELEGRAM_CHAT_ID=123456789
```

5. Запусти сайт:

```bash
node server.mjs
```

Открой http://localhost:8787 — форма внизу шлёт заявки боту в личку.

## Важно про токен

Если токен светился в чате/переписке — перевыпусти в [@BotFather](https://t.me/BotFather) (`/revoke`) и обнови `.env`. В HTML/JS токен класть нельзя.
