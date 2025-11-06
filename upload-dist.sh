#!/bin/bash

# Upload dist folder to server

echo "📦 Загрузка собранного фронтенда на сервер..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"

# Создаем архив dist
echo "🗜️ Создание архива dist..."
cd dist
tar -czf ../dist-new.tar.gz .
cd ..

echo "📤 Загрузка архива на сервер..."
sshpass -p "$SSH_PASS" scp -P $SSH_PORT -o StrictHostKeyChecking=no dist-new.tar.gz $SSH_USER@$SSH_HOST:~/

echo "📂 Распаковка на сервере..."
sshpass -p "$SSH_PASS" ssh -p $SSH_PORT -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Создаем бэкап старого dist
if [ -d "dist" ]; then
    echo "💾 Создание бэкапа старого dist..."
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Создаем новую директорию dist
mkdir -p dist

# Распаковываем новый dist
echo "📦 Распаковка нового dist..."
tar -xzf ~/dist-new.tar.gz -C dist/

# Удаляем архив
rm ~/dist-new.tar.gz

echo "✅ Фронтенд обновлен!"

# Показываем содержимое
echo "📋 Содержимое dist:"
ls -lh dist/

# Проверяем размер
echo "📊 Размер dist:"
du -sh dist/
ENDSSH

# Удаляем локальный архив
rm dist-new.tar.gz

echo "✅ Загрузка завершена!"
echo "🌐 Проверьте сайт: https://cook.windexs.ru"
echo "💡 Не забудьте очистить кеш браузера (Ctrl+Shift+R)"
