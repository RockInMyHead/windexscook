#!/bin/bash

# Quick status check script

echo "⚡ Быстрая проверка статуса сервера..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo ""
echo "🔍 Внешний статус:"
curl -k -s https://cook.windexs.ru/health | jq . 2>/dev/null || echo "❌ Сервис недоступен"

echo ""
echo "📊 PM2 статус на сервере:"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST "pm2 status windex-cook 2>/dev/null" 2>/dev/null || echo "❌ Не удалось подключиться к серверу"

echo ""
echo "💡 Если сервис недоступен, попробуйте:"
echo "   ./restart-server.sh    # Перезапуск"
echo "   ./diagnose-server.sh   # Полная диагностика"
