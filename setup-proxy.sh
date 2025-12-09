#!/bin/bash

# Скрипт для настройки прокси переменных окружения
# Использование: ./setup-proxy.sh

echo "🔧 Настройка прокси переменных окружения..."

# Устанавливаем переменные прокси
export PROXY_HOST=45.147.180.108
export PROXY_PORT=8000
export PROXY_USERNAME=gZcAuu
export PROXY_PASSWORD=sVXxpJ

echo "✅ Переменные окружения установлены:"
echo "   PROXY_HOST=$PROXY_HOST"
echo "   PROXY_PORT=$PROXY_PORT"
echo "   PROXY_USERNAME=$PROXY_USERNAME"
echo "   PROXY_PASSWORD=***"

# Проверяем, используется ли PM2
if command -v pm2 &> /dev/null; then
    echo ""
    echo "📝 Для постоянного сохранения переменных окружения:"
    echo "   1. Добавьте эти переменные в .env файл:"
    echo "      PROXY_HOST=45.147.180.108"
    echo "      PROXY_PORT=8000"
    echo "      PROXY_USERNAME=gZcAuu"
    echo "      PROXY_PASSWORD=sVXxpJ"
    echo ""
    echo "   2. Или добавьте в ~/.bashrc или ~/.profile:"
    echo "      export PROXY_HOST=45.147.180.108"
    echo "      export PROXY_PORT=8000"
    echo "      export PROXY_USERNAME=gZcAuu"
    echo "      export PROXY_PASSWORD=sVXxpJ"
    echo ""
    echo "   3. Перезапустите приложение:"
    echo "      pm2 restart windexscook"
    echo ""
    echo "   Или если используете другой процесс-менеджер:"
    echo "      systemctl restart windexscook"
    echo "      # или"
    echo "      supervisorctl restart windexscook"
else
    echo ""
    echo "⚠️  PM2 не найден. Убедитесь, что переменные окружения установлены"
    echo "   перед запуском приложения."
fi

echo ""
echo "✅ Готово! Переменные окружения установлены для текущей сессии."
