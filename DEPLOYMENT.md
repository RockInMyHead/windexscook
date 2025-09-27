# Инструкции по развертыванию Pastel Chef AI

## 🚀 Варианты деплоя

### 1. Docker (Рекомендуется)

#### Локальный запуск
```bash
# Сборка и запуск
docker-compose up --build

# Или через Docker напрямую
docker build -t pastel-chef-ai .
docker run -p 3001:3001 -e ELEVENLABS_API_KEY=your_key pastel-chef-ai
```

#### На сервере
```bash
# Клонирование репозитория
git clone https://github.com/RockInMyHead/windexscook.git
cd windexscook

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл с вашими API ключами

# Запуск через Docker Compose
docker-compose up -d
```

### 2. Прямой запуск на сервере

#### Требования
- Node.js 18+
- npm или yarn

#### Установка
```bash
# Клонирование
git clone https://github.com/RockInMyHead/windexscook.git
cd windexscook

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл

# Сборка и запуск
npm run build:prod
npm run server
```

### 3. PM2 (Production Process Manager)

```bash
# Установка PM2
npm install -g pm2

# Сборка приложения
npm run build:prod

# Запуск через PM2
pm2 start server.js --name "pastel-chef-ai"

# Сохранение конфигурации
pm2 save
pm2 startup
```

## 🔧 Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
# ElevenLabs API для голосового синтеза
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# OpenAI API для генерации рецептов
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Порт сервера (по умолчанию 3001)
PORT=3001

# Режим работы
NODE_ENV=production
```

## 🌐 Настройка веб-сервера

### Nginx конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Кэширование статических файлов
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Apache конфигурация

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    # Кэширование статических файлов
    <LocationMatch "/assets/.*">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
    </LocationMatch>
</VirtualHost>
```

## 🔒 SSL сертификаты

### Let's Encrypt (Certbot)
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавьте: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Мониторинг

### Health Check
Приложение предоставляет эндпоинт для проверки здоровья:
```
GET /health
```

Ответ:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Pastel Chef AI API Server"
}
```

### Логирование
```bash
# Docker логи
docker-compose logs -f

# PM2 логи
pm2 logs pastel-chef-ai

# Системные логи
journalctl -u your-service-name -f
```

## 🚨 Устранение неполадок

### Проблема: API запросы не работают
**Решение**: Убедитесь, что переменные окружения настроены правильно:
```bash
echo $ELEVENLABS_API_KEY
echo $VITE_OPENAI_API_KEY
```

### Проблема: Порт занят
**Решение**: Измените порт в переменных окружения:
```bash
export PORT=3002
```

### Проблема: Статические файлы не загружаются
**Решение**: Проверьте, что сборка прошла успешно:
```bash
npm run build:prod
ls -la dist/
```

## 🔄 Обновление

### Docker
```bash
git pull
docker-compose down
docker-compose up --build -d
```

### Прямой запуск
```bash
git pull
npm install
npm run build:prod
pm2 restart pastel-chef-ai
```

## 📈 Масштабирование

### Горизонтальное масштабирование
```yaml
# docker-compose.yml
services:
  pastel-chef-ai:
    scale: 3
    # ... остальная конфигурация
```

### Load Balancer (Nginx)
```nginx
upstream pastel_chef_backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    location / {
        proxy_pass http://pastel_chef_backend;
    }
}
```
