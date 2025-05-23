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

## 🟢 Поддержка нескольких подсетей и автоматическое сканирование

- Система поддерживает мониторинг устройств в нескольких подсетях одновременно.
- Для каждой подсети автоматически добавляется временный IP-адрес на интерфейс (например, 192.168.2.250/24), если его нет.
- Сканирование выполняется по всем подсетям, указанным в переменной окружения `NETWORK_BASES` (через запятую, например: `NETWORK_BASES=192.168.1,192.168.2,192.168.3`). Если переменная не указана — подсети определяются автоматически.
- Для поиска IP по MAC-адресу используется утилита `arp-scan` (требуется установка и права sudo). Это позволяет находить устройства даже если они не отвечают на ping.
- После сканирования ARP-таблица обновляется для всех доступных подсетей, и мониторинг работает максимально полно.

### Требования
- Установить `arp-scan`:
  ```bash
  sudo apt install arp-scan
  ```
- Для работы автоматического добавления IP-адресов и arp-scan скрипт должен запускаться с правами sudo или пользователь должен иметь соответствующие права.

---

## 🚀 Быстрый запуск через Docker Compose (обновлено)

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
   # NETWORK_BASES=192.168.1,192.168.2,192.168.3 (указывать при необходимости)
   ```

3. Запустите проект:
   ```bash
   docker-compose up --build -d
   ```

- Контейнер `monitoring` теперь автоматически устанавливает arp-scan и sudo для поиска устройств по MAC-адресу и поддержки нескольких подсетей.
- Для мониторинга нескольких сетей используйте переменную окружения `NETWORK_BASES` или оставьте автоопределение.

4. Откройте веб-интерфейс: [http://localhost:3000](http://localhost:3000)

- Контейнер `web` — основной сервер и фронтенд (порт 3000)
- Контейнер `monitoring` — сервис мониторинга устройств (работает в фоне)
- Контейнер `mongo` — база данных

Для остановки:
```bash
docker-compose down
```

---

## 🛠️ Работа с контейнерами и перезапуск

### Просмотр логов контейнеров

Показать логи всех контейнеров:
```bash
docker-compose logs -f
```
Показать логи конкретного контейнера (например, monitoring):
```bash
docker-compose logs -f monitoring
```

### Остановка всех контейнеров
```bash
docker-compose down
```

### Перезапуск контейнеров
```bash
docker-compose restart
```

### Полная очистка, удаление и пересборка
Удалить все контейнеры, тома и пересобрать проект:
```bash
docker-compose down -v
# (удаляет контейнеры и тома)
docker-compose build --no-cache
# (пересобирает образы)
docker-compose up -d
```

### Изменение .env и перезапуск
1. Остановите контейнеры:
   ```bash
   docker-compose down
   ```
2. Измените параметры в файле `.env`.
3. Перезапустите контейнеры:
   ```bash
   docker-compose up -d
   ```

---

## 🟢 Установка Node.js через nvm (альтернативно)

Если не используете Docker, рекомендуем установить Node.js через nvm:

1. Установите nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   ```
2. Перезапустите терминал и установите свежую версию Node.js:
   ```bash
   nvm install node
   nvm use node
   node -v
   npm -v
   ```

---

## 📦 Установка зависимостей (если не Docker)

Если запускаете проект без Docker, установите необходимые npm-зависимости:

```bash
npm install express node-fetch p-limit
```

---

## 🚀 Продакшен-режим с PM2

1. Установите pm2 глобально:
   ```bash
   npm install -g pm2
   ```

2. Запустите серверную часть:
   ```bash
   pm2 start server.js --name minepulse-web
   ```

3. Запустите мониторинг:
   ```bash
   pm2 start monitoring/app.js --name minepulse-monitoring
   ```

4. Основные команды управления:
   - Список процессов: `pm2 ls`
   - Перезапуск: `pm2 restart <name>`
   - Остановка: `pm2 stop <name>`
   - Удаление: `pm2 delete <name>`

---

## 📞 Поддержка

По вопросам и доработкам — свяжитесь с разработчиком.
