# Тесты бэкенда Windexs Cook

Этот каталог содержит тесты для функций бэкенда приложения Windexs Cook.

## Структура тестов

```
tests/
├── setup.js                 # Настройка тестового окружения
├── server.test.js           # Тесты основного сервера
├── services/                # Тесты сервисов
│   ├── openai.test.js       # Тесты OpenAI сервиса
│   ├── elevenlabs.test.js   # Тесты ElevenLabs сервиса
│   └── recipe.test.js       # Тесты Recipe сервиса
└── integration/             # Интеграционные тесты
    └── api.test.js          # Тесты API endpoints
```

## Запуск тестов

### Все тесты
```bash
npm test
```

### Тесты с покрытием
```bash
npm run test:coverage
```

### Конкретные группы тестов
```bash
# Тесты сервера
npm run test:server

# Тесты сервисов
npm run test:services

# Интеграционные тесты
npm run test:integration
```

### Режим наблюдения
```bash
npm run test:watch
```

## Что тестируется

### 1. Сервер (server.test.js)
- Health check endpoint
- CORS настройки
- Обработка ошибок
- Проксирование запросов

### 2. OpenAI сервис (openai.test.js)
- Генерация рецептов
- Чат с поваром
- Анализ изображений
- Подсчет калорий
- Обработка ошибок API

### 3. ElevenLabs сервис (elevenlabs.test.js)
- Синтез речи
- Получение списка голосов
- Настройки голоса
- Обработка ошибок

### 4. Recipe сервис (recipe.test.js)
- CRUD операции с рецептами
- Фильтрация рецептов
- Модерация рецептов
- Пользовательские рецепты

### 5. Интеграционные тесты (api.test.js)
- Полный цикл API запросов
- Проксирование к внешним сервисам
- Обработка больших payload
- CORS интеграция

## Моки и заглушки

Тесты используют моки для:
- axios (HTTP запросы)
- fs (файловая система)
- HttpsProxyAgent (прокси)
- localStorage (браузерное хранилище)

## Переменные окружения

Для тестов используются тестовые переменные:
- `NODE_ENV=test`
- `OPENAI_API_KEY=test-openai-key`
- `ELEVENLABS_API_KEY=test-elevenlabs-key`
- `PROXY_HOST=test-proxy-host`

## Покрытие кода

Тесты покрывают:
- Основные функции сервера
- Все методы сервисов
- Обработку ошибок
- Интеграционные сценарии

Запустите `npm run test:coverage` для просмотра детального отчета о покрытии.
