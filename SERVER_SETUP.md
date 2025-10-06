# Настройка сервера для Windexs Cook

## Проблема с генерацией рецептов

Если вы получаете ошибку:
```
[Warning] OpenAI API key not found in environment variables. API calls will be proxied through server.
[Error] Error generating recipe: SyntaxError: JSON Parse error: Unrecognized token 'П'
```

Это означает, что на сервере не настроен API ключ OpenAI.

## Решение

### 1. Подключитесь к серверу
```bash
ssh svr@37.110.51.35 -p 1030
```

### 2. Перейдите в директорию проекта
```bash
cd /home/svr/cook
```

### 3. Создайте файл .env
```bash
nano .env
```

### 4. Добавьте в .env следующие переменные:
```env
# OpenAI API Configuration
OPENAI_API_KEY=your_actual_openai_api_key_here

# Proxy Configuration
PROXY_HOST=185.68.187.46
PROXY_PORT=8000
PROXY_USERNAME=FeCuvT
PROXY_PASSWORD=aeUYh

# ElevenLabs API Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Server Configuration
PORT=1031
NODE_ENV=production
```

### 5. Замените `your_actual_openai_api_key_here` на реальный API ключ OpenAI

### 6. Перезапустите приложение
```bash
pm2 restart windex-cook
```

### 7. Проверьте логи
```bash
pm2 logs windex-cook
```

## Проверка работы

После настройки API ключа:
1. Откройте https://cook.windexs.ru
2. Войдите в аккаунт
3. Активируйте Premium подписку
4. Попробуйте сгенерировать рецепт в разделе "Мои рецепты"

## Дополнительная диагностика

Если проблема остается:

### Проверьте переменные окружения
```bash
pm2 show windex-cook
```

### Проверьте, что .env файл загружается
```bash
cd /home/svr/cook
node -e "require('dotenv').config(); console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');"
```

### Проверьте логи сервера
```bash
pm2 logs windex-cook --lines 50
```

## Важные замечания

1. **API ключ OpenAI** должен быть действительным и иметь достаточный баланс
2. **Прокси настройки** уже настроены и должны работать
3. **Порт 1031** должен быть открыт в файрволе
4. **PM2** должен быть запущен и показывать статус "online"
