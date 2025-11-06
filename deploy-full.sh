#!/bin/bash

# Full deployment script: build + deploy + restart

echo "🚀 Полный деплой Windexs Cook..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo ""
echo -e "${YELLOW}📦 Этап 1: Сборка фронтенда...${NC}"
npm run build:prod

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка сборки фронтенда${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Фронтенд собран${NC}"

echo ""
echo -e "${YELLOW}📤 Этап 2: Загрузка на сервер...${NC}"

# Создаем архив dist
echo "🗜️ Создание архива dist..."
tar -czf dist-deploy.tar.gz dist/

# Загружаем на сервер
echo "📤 Загрузка архива..."
if ! sshpass -p "$SSH_PASS" scp -P $SSH_PORT $SSH_OPTS dist-deploy.tar.gz $SSH_USER@$SSH_HOST:~/; then
    echo -e "${RED}❌ Ошибка загрузки файлов${NC}"
    rm dist-deploy.tar.gz
    exit 1
fi

# Удаляем локальный архив
rm dist-deploy.tar.gz

echo -e "${GREEN}✅ Файлы загружены${NC}"

echo ""
echo -e "${YELLOW}🔄 Этап 3: Обновление на сервере...${NC}"

sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

echo "📦 Распаковка фронтенда..."
# Создаем бэкап старого dist
if [ -d "dist" ]; then
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Распаковываем новый dist
mkdir -p dist
tar -xzf ~/dist-deploy.tar.gz -C ./
rm ~/dist-deploy.tar.gz

echo "🔄 Перезапуск сервера..."
# Останавливаем старый процесс
pm2 stop windex-cook 2>/dev/null || true
pm2 delete windex-cook 2>/dev/null || true

# Запускаем новый процесс
PORT=1031 pm2 start server.js --name windex-cook
pm2 save

echo "📊 Проверка статуса..."
sleep 3

# Проверяем локальный API
if curl -f http://localhost:1031/health > /dev/null 2>&1; then
    echo "✅ Сервер отвечает на localhost:1031"
else
    echo "❌ Сервер не отвечает локально"
fi

echo "📋 PM2 статус:"
pm2 status windex-cook

echo "📄 Последние логи:"
pm2 logs windex-cook --lines 5 --nostream
ENDSSH

echo ""
echo -e "${YELLOW}🌐 Этап 4: Финальная проверка...${NC}"

# Проверяем внешний API
sleep 2
if curl -k -f https://cook.windexs.ru/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Сервер отвечает на https://cook.windexs.ru${NC}"
else
    echo -e "${RED}❌ Сервер не отвечает извне${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Деплой завершен!${NC}"
echo ""
echo "📋 Что проверить:"
echo "1. 🌐 Сайт: https://cook.windexs.ru"
echo "2. 💬 Чат с шеф-поваром"
echo "3. 🧹 Очистить кеш браузера: Ctrl+Shift+R"
echo ""
echo "🔧 Если проблемы:"
echo "   ./diagnose-server.sh    # Диагностика"
echo "   ./restart-server.sh     # Перезапуск"
echo "   pm2 logs windex-cook    # Логи (на сервере)"
