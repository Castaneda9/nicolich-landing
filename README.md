# Визитка + форма → Telegram

Токен бота и `chat_id` хранятся только в `.env` (в git не попадает).

Прод: Worker `https://nicolich-landing.nicolich92.workers.dev`

## Привязать свой домен (nicolich2.com и т.п.)

Сайт на **Cloudflare Worker** — это не обычный сервер с IP.  
Поэтому **не нужна A-запись с IPv4**. Нужен **Custom Domain** у Worker: Cloudflare сам создаст DNS.

1. Экран «Проверьте DNS / найдено 0 записей / добавьте A и MX» — **пропусти**.  
   MX не нужен (почты нет). A вручную не заполняй.
2. Меню слева: **Workers & Pages** → проект **nicolich-landing**.
3. **Settings** → **Domains & Routes** / **Пользовательские домены**.
4. **Add** → **Custom Domain** / подключиться к зоне `nicolich2.com`.
5. Поле «Поддомен»:
   - для `https://nicolich2.com` — **оставь пустым** → Добавить;
   - для `www` — впиши только `www` (без точки и без имени домена) → Добавить.
6. У регистратора домена NS должны быть Cloudflare (как в мастере CF). Без этого свой домен в интернете не заработает, даже если Worker уже открывается на `*.workers.dev`.

Готово, когда `https://nicolich2.com` открывает тот же сайт, что и `*.workers.dev`.

## Локальный запуск (форма → Telegram)

1. Скопируй `.env.example` → `.env` и вставь токен бота.
2. Напиши боту `/start` в Telegram.
3. Узнай `chat_id`:

```bash
node server.mjs --get-chat-id
```

4. Впиши в `.env`: `TELEGRAM_CHAT_ID=...`
5. Запуск:

```bash
node server.mjs
```

Открой http://localhost:8787

## Важно про токен

Если токен светился в чате — перевыпусти в [@BotFather](https://t.me/BotFather) и обнови `.env`. В HTML/JS токен класть нельзя.
