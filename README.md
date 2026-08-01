# Sanna Arabic SRS

Telegram Mini App для изучения арабской лексики: словарь, колоды и mock-тренировки до подключения backend.

## Локальный запуск

```bash
pnpm install
pnpm dev
```

Проверка проекта:

```bash
pnpm check
pnpm test:e2e --project=mobile-chrome
```

## Словарные данные

`public/data/lexemes.json` содержит 918 публичных записей без внутренних `review`, `source`, `root_source` и `root_confidence`. Для повторной генерации:

```bash
pnpm data:prepare [input.json] [output.json]
```

## Vercel и Telegram

1. Импортируйте GitHub-репозиторий в Vercel. Framework Preset: Vite; Build Command: `pnpm build`; Output Directory: `dist`.
2. Vercel применит SPA rewrite из `vercel.json`.
3. Добавьте production HTTPS URL в BotFather как URL Mini App.
4. Когда появится backend, задайте публичный `VITE_API_BASE_URL`; bot token должен храниться только на сервере.
