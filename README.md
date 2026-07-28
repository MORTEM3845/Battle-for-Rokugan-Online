# Battle for Rokugan Online

Браузерный прототип «Битвы за Рокуган» на React, TypeScript и Cloudflare Workers.

## Первый запуск

Требования:

- Git
- Node.js 22 LTS
- VS Code

```powershell
cd C:\Projects
git clone https://github.com/MORTEM3845/Battle-for-Rokugan-Online.git
cd Battle-for-Rokugan-Online
npm install
npm run dev
```

После запуска откройте адрес, который напечатает Vite, обычно `http://localhost:5173`.

## Что уже реализовано

- создание комнаты со случайным шестизначным кодом;
- подключение по ссылке и коду;
- восстановление локальной сессии после обновления страницы;
- комната на двух игроков;
- добавление и удаление случайного бота;
- выбор одного из семи кланов;
- готовность игроков;
- запуск игры хозяином комнаты;
- хранение комнаты в Cloudflare Durable Object;
- заглушка игрового экрана после запуска.

## Команды

```powershell
npm run dev
npm run typecheck
npm run build
npx wrangler login
npm run deploy
```

## Структура

- `src/` — React-интерфейс;
- `worker/` — Cloudflare Worker и Durable Object комнаты;
- `shared/` — общие TypeScript-типы клиента и сервера;
- `wrangler.jsonc` — конфигурация Cloudflare;
- `vite.config.ts` — React, Vite и Cloudflare Vite Plugin.

На первом этапе клиент обновляет состояние комнаты раз в секунду. WebSocket будет добавлен вместе с активным игровым циклом, когда появятся ходы и действия бота.
