#!/bin/bash

# Quick restart script for server

echo "🔄 Перезапуск сервера cook.windexs.ru..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "1️⃣ Остановка старого процесса..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
pm2 stop windex-cook 2>/dev/null || true
pm2 delete windex-cook 2>/dev/null || true
echo "✅ Старый процесс остановлен"
ENDSSH

echo ""
echo "2️⃣ Запуск нового процесса..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
PORT=1031 pm2 start server.js --name windex-cook
pm2 save
echo "✅ Новый процесс запущен"
ENDSSH

echo ""
echo "3️⃣ Проверка статуса..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
echo "📊 PM2 статус:"
pm2 status windex-cook

echo ""
echo "🔍 Локальный health check:"
curl -f http://localhost:1031/health 2>/dev/null || echo "❌ Локальный API не отвечает"
ENDSSH

echo ""
echo "4️⃣ Проверка внешнего доступа..."
sleep 3
curl -k -s https://cook.windexs.ru/health | jq .status 2>/dev/null || echo "❌ Внешний API не отвечает"

echo ""
echo "✅ Перезапуск завершен!"
echo "🌐 Проверьте: https://cook.windexs.ru"
