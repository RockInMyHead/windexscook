# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем ВСЕ зависимости (включая dev для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение для продакшена
RUN npm run build:prod

# Удаляем dev зависимости после сборки
RUN npm prune --production

# Создаем директорию для логов
RUN mkdir -p logs

# Открываем порт
EXPOSE 1041

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Меняем владельца файлов и даем права на запись в logs
RUN chown -R nextjs:nodejs /app
RUN chmod 755 logs
USER nextjs

# Запускаем сервер
CMD ["npm", "run", "server"]
