# Инструкции для DevOps по развертыванию Pastel Chef AI

## 🚀 Варианты развертывания

### 1. Docker (Рекомендуется)

#### Быстрый запуск:
```bash
# Клонирование репозитория
git clone https://github.com/RockInMyHead/windexscook.git
cd windexscook

# Создание .env файла
cat > .env << EOF
ELEVENLABS_API_KEY=your_elevenlabs_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
EOF

# Сборка и запуск
docker-compose up -d
```

#### Только API сервер:
```bash
docker-compose up -d pastel-chef-api
```

#### С nginx (полный стек):
```bash
docker-compose --profile nginx up -d
```

### 2. Прямой запуск Node.js

#### Установка зависимостей:
```bash
npm install
```

#### Сборка фронтенда:
```bash
npm run build
```

#### Запуск API сервера:
```bash
npm run server
```

### 3. PM2 (Production)

#### Установка PM2:
```bash
npm install -g pm2
```

#### Конфигурация PM2:
```bash
# Создание ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'pastel-chef-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      VITE_OPENAI_API_KEY: process.env.VITE_OPENAI_API_KEY
    }
  }]
}
EOF
```

#### Запуск с PM2:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🔧 Конфигурация

### Переменные окружения

#### Обязательные:
- `ELEVENLABS_API_KEY` - API ключ ElevenLabs для голосового синтеза
- `VITE_OPENAI_API_KEY` - API ключ OpenAI для генерации рецептов

#### Опциональные:
- `PORT` - Порт для API сервера (по умолчанию 3001)
- `NODE_ENV` - Окружение (production/development)

### Настройка прокси

#### Nginx конфигурация:
```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

#### Apache конфигурация:
```apache
ProxyPass /api/ http://localhost:3001/
ProxyPassReverse /api/ http://localhost:3001/
```

## 📡 API Endpoints

### Основные эндпоинты:
- `GET /health` - Проверка состояния сервера
- `GET /api/info` - Информация об API
- `POST /api/elevenlabs/text-to-speech/{voiceId}` - Синтез речи
- `GET /api/elevenlabs/voices` - Список голосов
- `POST /api/openai/chat/completions` - OpenAI чат

### Примеры запросов:

#### Проверка здоровья:
```bash
curl http://localhost:3001/health
```

#### Получение голосов ElevenLabs:
```bash
curl http://localhost:3001/api/elevenlabs/voices
```

#### Синтез речи:
```bash
curl -X POST http://localhost:3001/api/elevenlabs/text-to-speech/pNInz6obpgDQGcFmaJgB \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет, это тест голоса!"}'
```

## 🔒 Безопасность

### Рекомендации:
1. **Используйте HTTPS** в продакшене
2. **Ограничьте CORS** для вашего домена
3. **Настройте rate limiting** для API
4. **Используйте reverse proxy** (nginx/Apache)
5. **Регулярно обновляйте** зависимости

### Настройка CORS:
```javascript
// В server.js
app.use(cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  credentials: true
}));
```

## 📊 Мониторинг

### Health Check:
```bash
# Проверка состояния
curl http://localhost:3001/health

# Ответ:
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "elevenlabs": true,
    "openai": true
  }
}
```

### Логирование:
- Логи API запросов в консоль
- Ошибки с детальной информацией
- Timestamp для всех событий

## 🚨 Troubleshooting

### Частые проблемы:

#### 1. API ключи не работают:
```bash
# Проверка переменных окружения
echo $ELEVENLABS_API_KEY
echo $VITE_OPENAI_API_KEY
```

#### 2. Порт занят:
```bash
# Проверка занятых портов
lsof -i :3001
netstat -tulpn | grep 3001
```

#### 3. CORS ошибки:
- Проверьте настройки CORS в server.js
- Убедитесь, что фронтенд обращается к правильному домену

#### 4. Docker проблемы:
```bash
# Пересборка контейнера
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📈 Масштабирование

### Горизонтальное масштабирование:
1. Запустите несколько экземпляров API сервера
2. Используйте load balancer (nginx, HAProxy)
3. Настройте sticky sessions если нужно

### Вертикальное масштабирование:
1. Увеличьте ресурсы сервера
2. Настройте PM2 с несколькими процессами
3. Оптимизируйте базу данных (если используется)

## 🔄 CI/CD

### GitHub Actions пример:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          docker-compose down
          docker-compose up -d --build
```

---

**Для получения дополнительной помощи обращайтесь к разработчику проекта**
