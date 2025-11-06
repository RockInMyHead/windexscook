#!/bin/bash

# Diagnostic script for server troubleshooting

echo "🔍 Диагностика сервера cook.windexs.ru..."
echo "=========================================="

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo ""
echo "1️⃣ Проверка доступности сервера..."
ping -c 3 $SSH_HOST > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Сервер доступен"
else
    echo "❌ Сервер недоступен"
    exit 1
fi

echo ""
echo "2️⃣ Проверка SSH подключения..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST "echo 'SSH OK'" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ SSH подключение работает"
else
    echo "❌ SSH подключение не работает"
    exit 1
fi

echo ""
echo "3️⃣ Проверка состояния системы..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
echo "📊 Системная информация:"
echo "CPU: $(nproc) cores"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4}') free"

echo ""
echo "🔧 Node.js версия:"
if command -v node &> /dev/null; then
    echo "Node.js: $(node --version)"
else
    echo "❌ Node.js не установлен"
fi

echo ""
echo "📁 Содержимое директории cook:"
if [ -d "~/cook" ]; then
    ls -la ~/cook | head -10
else
    echo "❌ Директория ~/cook не существует"
fi

echo ""
echo "⚙️ Переменные окружения:"
if [ -f "~/cook/.env" ]; then
    echo "✅ Файл .env существует"
    grep -E "(ELEVENLABS_API_KEY|VITE_OPENAI_API_KEY|PORT)" ~/cook/.env | sed 's/=.*/=***/' || echo "API ключи не найдены"
else
    echo "❌ Файл .env не найден"
fi
ENDSSH

echo ""
echo "4️⃣ Проверка PM2..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
echo "📊 PM2 статус:"
pm2 list 2>/dev/null || echo "❌ PM2 не установлен или не работает"

echo ""
echo "🔍 Логи PM2 (последние 10 строк):"
pm2 logs windex-cook --lines 10 --nostream 2>/dev/null || echo "❌ Логи недоступны"

echo ""
echo "🌐 Проверка локального порта 1031:"
netstat -tlnp 2>/dev/null | grep :1031 || echo "❌ Порт 1031 не прослушивается"

echo ""
echo "🧪 Тест локального API:"
curl -f http://localhost:1031/health 2>/dev/null || echo "❌ Локальный API не отвечает"
ENDSSH

echo ""
echo "5️⃣ Проверка веб-сервера..."
echo "🌐 Внешний health check:"
curl -k -s https://cook.windexs.ru/health | head -c 100 || echo "❌ Внешний API не отвечает"

echo ""
echo "🔧 Nginx статус:"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
sudo systemctl status nginx --no-pager -l | head -10
echo ""
echo "📋 Nginx конфигурация:"
if [ -f "/etc/nginx/sites-enabled/cook.windexs.ru.conf" ]; then
    echo "✅ Nginx конфиг существует"
    sudo nginx -t 2>&1 || echo "❌ Ошибка в nginx конфигурации"
else
    echo "❌ Nginx конфиг не найден"
fi
ENDSSH

echo ""
echo "📋 РЕКОМЕНДАЦИИ:"
echo "1. Если PM2 не запущен: pm2 start ~/cook/server.js --name windex-cook"
echo "2. Если API ключи отсутствуют: отредактируйте ~/cook/.env"
echo "3. Проверьте логи: pm2 logs windex-cook"
echo "4. Перезапустите: pm2 restart windex-cook"
echo "5. Если ничего не помогает: ./deploy.sh (передеплой)"

echo ""
echo "✅ Диагностика завершена!"
