# MINE PULSE

Современная система мониторинга устройств с поддержкой Telegram-уведомлений и удобным веб-интерфейсом.

---

## Основные возможности

- Мониторинг устройств по IP и/или MAC-адресу (автоматический поиск IP по MAC через ARP)
- Веб-интерфейс для управления моделями устройств и Telegram-настройками
- Telegram-уведомления по расписанию (только агрегированная статистика)
- Современный минималистичный интерфейс (Bootstrap, быстрый отклик, спиннеры)
- Гибкая настройка только через .env (все параметры — только там)
- Лаконичные логи, только нужная информация
- Высокая производительность (асинхронный опрос, p-limit)
- Безопасность: все данные внутри вашей инфраструктуры
- Лёгкий запуск и обновление через Docker Compose

---

## 📋 Описание

Проект обеспечивает автоматическую проверку состояния устройств, регистрацию ошибок, рассылку уведомлений и доступный веб-интерфейс для контроля в реальном времени.

---

## 🛠️ Структура проекта

```
MINE_PULSE/
├── .env
├── app.js                # основной сервер (web)
├── server.js             # запуск web-сервера
├── telegram.js           # отправка уведомлений в Telegram
├── docker-compose.yml    # запуск всех сервисов
├── monitoring/           # сервис мониторинга устройств
│   ├── app.js
│   ├── package.json
│   └── ...
├── models/               # модели MongoDB
│   ├── admin.js
│   ├── device.js
│   ├── pingError.js
│   └── settings.js
├── public/               # фронтенд (dashboard)
│   ├── dashboard.html
│   └── logo.png
└── README.md
```

---

## ⚙️ Как работает

- Массовое асинхронное пингование устройств
- Поиск IP по MAC (если включено)
- Регистрация ошибок и уведомление через Telegram
- Веб-панель для мониторинга статуса устройств
- Хранение данных в MongoDB

---

## 🚀 Быстрый запуск через Docker Compose

1. Клонируйте репозиторий:
   ```bash
   git clone <репозиторий>
   cd <папка_проекта>
   ```

2. Создайте файл `.env`:
   ```env
   MONGO_URI=mongodb://mine_pulse_mongo:27017/mine_pulse
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   CHAT_ID=your_telegram_chat_id
   PING_INTERVAL=60
   MONITORING_ENABLED=true
   MAC_TO_IP_ENABLED=true
   ```

3. Запустите проект:
   ```bash
   docker-compose up --build -d
   ```

4. Откройте веб-интерфейс: [http://localhost:3000](http://localhost:3000)

- Контейнер `web` — основной сервер и фронтенд (порт 3000)
- Контейнер `monitoring` — сервис мониторинга устройств (работает в фоне)
- Контейнер `mongo` — база данных

Для остановки:
```bash
docker-compose down
```

## 🟢 Установка Node.js через nvm (альтернативно)

Если не используете Docker, рекомендуем установить Node.js через nvm:

1. Установите nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   # или для Windows: https://github.com/coreybutler/nvm-windows
   ```
2. Перезапустите терминал и установите свежую версию Node.js:
   ```bash
   nvm install node
   nvm use node
   node -v
   npm -v
   ```

## 📦 Установка зависимостей (если не Docker)

Если запускаете проект без Docker, установите необходимые npm-зависимости:

```bash
npm install express node-fetch p-limit
```

---

## Документация

- [Обзор проекта](./docs/overview.md)
- [Устройства](./docs/devices.md)
- [Настройки и Telegram](./docs/settings.md)

---

## 📞 Поддержка

По вопросам и доработкам — свяжитесь с разработчиком.

---