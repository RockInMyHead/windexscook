#!/bin/bash

# Quick update script - updates code and restarts server
# Используйте этот скрипт когда нужно быстро обновить код и перезапустить сервер

echo "🚀 Быстрое обновление сервера..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"

# Get API key from local .env
if [ -f .env ]; then
  source .env
  OPENAI_KEY=$VITE_OPENAI_API_KEY
else
  echo "❌ .env file not found"
  exit 1
fi

echo "1️⃣ Обновление кода на сервере..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
git fetch origin
git reset --hard origin/main
echo "✅ Код обновлен"
ENDSSH

echo ""
echo "2️⃣ Обновление .env файла..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST bash << ENDSSH
cd ~/cook
# Обновляем OPENAI_API_KEY в .env
if grep -q "^OPENAI_API_KEY=" .env; then
  sed -i 's|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${OPENAI_KEY}|' .env
else
  echo "OPENAI_API_KEY=${OPENAI_KEY}" >> .env
fi
echo "✅ .env обновлен"
cat .env | grep -E "OPENAI_API_KEY|VITE_OPENAI_API_KEY"
ENDSSH

echo ""
echo "3️⃣ Перезапуск PM2..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
pm2 restart windex-cook || (pm2 delete windex-cook 2>/dev/null; PORT=1031 pm2 start server.js --name windex-cook)
pm2 save
echo "✅ PM2 перезапущен"
ENDSSH

echo ""
echo "4️⃣ Проверка статуса..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
pm2 status windex-cook
pm2 logs windex-cook --lines 10 --nostream
ENDSSH

echo ""
echo "✅ Обновление завершено!"
echo "🌐 Проверьте: https://cook.windexs.ru"
