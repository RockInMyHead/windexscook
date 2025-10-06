#!/bin/bash

echo "🧪 Запуск тестов бэкенда Windexs Cook"
echo "======================================"

# Устанавливаем переменные окружения для тестов
export NODE_ENV=test
export OPENAI_API_KEY=test-openai-key
export ELEVENLABS_API_KEY=test-elevenlabs-key
export PROXY_HOST=test-proxy-host
export PROXY_PORT=8000
export PROXY_USERNAME=test-user
export PROXY_PASSWORD=test-pass

echo "📋 Запуск всех тестов..."
npm test

echo ""
echo "📊 Запуск тестов с покрытием..."
npm run test:coverage

echo ""
echo "✅ Тестирование завершено!"
echo "📁 Отчеты о покрытии доступны в папке coverage/"
