# Решение проблемы 404 ошибки с OpenAI API

## Проблема
В браузере появляется ошибка:
```
[Error] Failed to load resource: the server responded with a status of 404 (Not Found) (completions, line 0)
```

## Причина
Браузер использует кэшированную версию старого кода, где API запросы шли напрямую к `api.openai.com` вместо прокси `/api/openai`.

## Решение

### 1. Очистите кэш браузера
- **Chrome/Edge**: Ctrl+Shift+R (или Cmd+Shift+R на Mac)
- **Firefox**: Ctrl+F5 (или Cmd+Shift+R на Mac)
- **Safari**: Cmd+Option+R

### 2. Откройте DevTools и отключите кэш
1. Откройте DevTools (F12)
2. Перейдите на вкладку Network
3. Поставьте галочку "Disable cache"
4. Обновите страницу

### 3. Проверьте Network tab
После обновления в Network tab должны быть запросы к:
- `/api/openai/v1/chat/completions` ✅
- НЕ должно быть запросов к `api.openai.com` ❌

### 4. Если проблема остается
1. Проверьте, что сервер запущен: `http://localhost:3001/health`
2. Проверьте конфигурацию: `http://localhost:3001/config`
3. Убедитесь, что API ключи настроены в переменных окружения

## Текущий статус сервера
- ✅ Прокси настроен: `185.68.187.46:8000`
- ✅ API роуты работают: `/api/openai/*` и `/api/elevenlabs/*`
- ✅ Логирование активно
- ⚠️ API ключи нужно настроить в переменных окружения

## Настройка API ключей
Создайте файл `.env` в корне проекта:
```bash
ELEVENLABS_API_KEY=your_elevenlabs_key
VITE_OPENAI_API_KEY=your_openai_key
```

Или установите переменные окружения:
```bash
export ELEVENLABS_API_KEY=your_elevenlabs_key
export VITE_OPENAI_API_KEY=your_openai_key
```
