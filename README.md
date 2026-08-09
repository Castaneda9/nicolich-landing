# Визитка Денис Николич

Прод: https://nicolich-landing.nicolich92.workers.dev

## Форма → Telegram на Cloudflare (важно)

Сайт на Worker. Форма шлёт `POST /api/lead`. Токен бота **не** в HTML — только в Secrets.

### 1. Secrets в Cloudflare (ты уже нашёл Variables / Secrets)

Workers & Pages → **nicolich-landing** → **Settings** → **Variables and Secrets** → **Add**:

| Имя | Тип | Значение |
|-----|-----|----------|
| `TELEGRAM_BOT_TOKEN` | **Secret** | токен от BotFather |
| `TELEGRAM_CHAT_ID` | **Secret** | `6028449404` |

Environment: **Production** (и Preview, если есть).

### 2. Задеплоить код с `/api/lead`

На своём Mac в папке проекта:

```bash
cd ~/Projects/nicolich-landing
npm install
npx wrangler login
npm run deploy
```

После деплоя открой сайт и отправь тестовую заявку — должно прийти в Telegram.

Если деплой идёт с GitHub автоматически — после `git push` дождись билда и всё равно **проверь, что secrets заданы** (иначе форма ответит ошибкой настройки).

### 3. Проверка

1. Открой https://nicolich-landing.nicolich92.workers.dev  
2. Заполни форму → Отправить  
3. В Telegram должна прийти заявка  

Если ошибка «Сервер не настроен» — не заданы secrets.  
Если «Сервер формы недоступен» — задеплоен старый билд без Worker API.

---

## Локально

1. Скопируй `.env.example` → `.env`
2. Впиши `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID=6028449404`
3. `npm run dev` → http://localhost:8787

Узнать chat_id снова: `npm run chat-id` (сначала `/start` боту).

## Важно

Токены не коммитить. Если токен светился в чате — перевыпусти в BotFather.
