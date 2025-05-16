# Используем официальный Node.js образ
FROM node:20

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package.json ./
RUN cat /etc/resolv.conf
RUN ping -c 3 registry.npmjs.org || true
RUN npm install

# Копируем всё остальное
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "server.js"]
