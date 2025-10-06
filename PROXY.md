# Настройка прокси для OpenAI

Этот проект может отправлять запросы к OpenAI через HTTP(S) прокси для обхода региональных ограничений.

## Данные прокси

- Хост: `185.68.187.126`
- Порт: `8000`
- Логин: `4Vh0VJ`
- Пароль: `5Mj2ws`

Строка подключения:

```
http://4Vh0VJ:5Mj2ws@185.68.187.126:8000/
```

## Переменные окружения (.env)

Добавьте (или обновите) следующие переменные в `.env` на сервере:

```
PROXY_HOST=185.68.187.126
PROXY_PORT=8000
PROXY_USERNAME=4Vh0VJ
PROXY_PASSWORD=5Mj2ws

# Опционально — чтобы инструменты по умолчанию использовали прокси
HTTP_PROXY=http://4Vh0VJ:5Mj2ws@185.68.187.126:8000/
HTTPS_PROXY=http://4Vh0VJ:5Mj2ws@185.68.187.126:8000/
http_proxy=http://4Vh0VJ:5Mj2ws@185.68.187.126:8000/
https_proxy=http://4Vh0VJ:5Mj2ws@185.68.187.126:8000/
```

## Сервер (Node.js)

Серверная часть использует `https-proxy-agent` для проксирования запросов к OpenAI. Ключевые моменты:

- Агент создается из `PROXY_*` переменных окружения
- Для запросов к `https://api.openai.com/...` указываются `httpsAgent`/`httpAgent`

Пример кода (фрагмент):

```ts
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// пример axios-запроса
await axios({
  method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  headers: { Authorization: `Bearer ${process.env.VITE_OPENAI_API_KEY}` },
  data: JSON.stringify(body),
  httpsAgent: proxyAgent,
  httpAgent: proxyAgent,
});
```

## Перезапуск сервера

После изменения `.env` перезапустите сервер:

```
pkill -f 'node.*server' || true
~/.nvm/versions/node/v18.20.8/bin/node server.js > server.log 2>&1 &
```

## Проверка

Локально на сервере выполните:

```
curl -X POST http://localhost:1031/api/openai/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}],"max_tokens":10}'
```

Ожидаемый результат: ответ от OpenAI (код 200/400/401), а не ошибки `403 unsupported_country_region_territory` или `407 Proxy Authentication Required`.

## Частые ошибки

- 407 Proxy Authentication Required — проверьте логин/пароль прокси и доступность узла/порта
- 403 unsupported_country_region_territory — запрос ушёл без прокси; убедитесь, что используется proxy-агент
- ETIMEDOUT/ECONNRESET — нестабильность прокси; повторите запрос или используйте другой прокси

## Безопасность

- Не коммитьте реальные креденшелы в публичный репозиторий
- Храните секреты в `.env` и менеджерах секретов CI/CD



