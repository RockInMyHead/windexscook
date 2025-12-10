# Исправление ошибки 500 для TTS и транскрибации

## Проблема
Ошибка 500 при попытке использовать TTS (синтез речи) и STT (транскрибацию) в голосовом чате.

**Причина:** Сервер не находит переменную окружения `OPENAI_API_KEY` (только `VITE_OPENAI_API_KEY`).

## Что исправлено в коде (уже в GitHub)
1. ✅ `server.js` - эндпоинт `/api/openai/tts` теперь читает `OPENAI_API_KEY` или `VITE_OPENAI_API_KEY`
2. ✅ `server.js` - эндпоинт `/api/audio/transcriptions` теперь читает `OPENAI_API_KEY` или `VITE_OPENAI_API_KEY`  
3. ✅ `deploy.sh` - теперь создает обе переменные в `.env` на сервере

## Как применить исправление на сервере

### Вариант 1: Через SSH (рекомендуется)

```bash
# Подключитесь к серверу
ssh -p 1030 svr@37.110.51.35

# Перейдите в директорию проекта
cd ~/cook

# Обновите код
git pull origin main

# Обновите .env файл (добавьте строку или замените существующую)
# Замените YOUR_OPENAI_KEY на ваш реальный ключ OpenAI из локального .env файла
echo "OPENAI_API_KEY=YOUR_OPENAI_KEY" >> .env

# Или отредактируйте вручную
nano .env
# Добавьте строку:
# OPENAI_API_KEY=sk-proj-...

# Перезапустите PM2
pm2 restart windex-cook

# Проверьте логи
pm2 logs windex-cook --lines 20
```

### Вариант 2: Через скрипт quick-update.sh (когда SSH заработает)

```bash
cd /Users/artembutko/sosyn/windexscook
./quick-update.sh
```

### Вариант 3: Полный деплой

```bash
cd /Users/artembutko/sosyn/windexscook
source .env
export OPENAI_API_KEY=$VITE_OPENAI_API_KEY
./deploy.sh
```

## Проверка

После применения исправления проверьте:

```bash
# На сервере
curl http://localhost:1031/health

# Извне
curl -k https://cook.windexs.ru/health

# Проверьте логи PM2
pm2 logs windex-cook --lines 50
```

## Текущая ситуация

- ✅ Код исправлен и запушен в GitHub (commit: a0cad61)
- ✅ Веб-сервер работает: https://cook.windexs.ru
- ⚠️ SSH подключение временно недоступно (connection timeout)
- ⏳ Нужно обновить `.env` на сервере когда SSH станет доступен

## Что проверить в .env на сервере

Файл `~/cook/.env` должен содержать:

```bash
# Обе переменные должны быть с одинаковым ключом
OPENAI_API_KEY=sk-proj-...ваш-ключ...
VITE_OPENAI_API_KEY=sk-proj-...ваш-ключ...
```

## Логи для отладки

Если ошибка сохраняется, проверьте логи:

```bash
pm2 logs windex-cook --lines 100 | grep -E "TTS|transcription|OPENAI_API_KEY"
```

Ищите строки:
- `✅ [TTS API] OpenAI API key is available` - ключ найден
- `❌ [TTS API] OpenAI API key not configured` - ключ НЕ найден
