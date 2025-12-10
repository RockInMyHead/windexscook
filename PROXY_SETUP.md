# Настройка прокси для сервера

## Вариант 1: Через переменные окружения в текущей сессии

Выполните на сервере:

```bash
export PROXY_HOST=45.147.180.108
export PROXY_PORT=8000
export PROXY_USERNAME=gZcAuu
export PROXY_PASSWORD=sVXxpJ

# Перезапустите приложение
pm2 restart windexscook
```

## Вариант 2: Добавить в .env файл (рекомендуется)

Добавьте в файл `.env` на сервере:

```env
PROXY_HOST=45.147.180.108
PROXY_PORT=8000
PROXY_USERNAME=gZcAuu
PROXY_PASSWORD=sVXxpJ
```

Затем перезапустите приложение:
```bash
pm2 restart windexscook
```

## Вариант 3: Через PM2 ecosystem файл

Если используете PM2 ecosystem файл, добавьте в секцию `env`:

```javascript
{
  "apps": [{
    "name": "windexscook",
    "env": {
      "PROXY_HOST": "45.147.180.108",
      "PROXY_PORT": "8000",
      "PROXY_USERNAME": "gZcAuu",
      "PROXY_PASSWORD": "sVXxpJ"
    }
  }]
}
```

## Вариант 4: Добавить в ~/.bashrc или ~/.profile

Добавьте в конец файла `~/.bashrc` или `~/.profile`:

```bash
export PROXY_HOST=45.147.180.108
export PROXY_PORT=8000
export PROXY_USERNAME=gZcAuu
export PROXY_PASSWORD=sVXxpJ
```

Затем выполните:
```bash
source ~/.bashrc
# или
source ~/.profile

pm2 restart windexscook
```

## Проверка

После перезапуска проверьте логи:
```bash
pm2 logs windexscook | grep "Proxy configuration"
```

Должно быть:
```
🔧 Proxy configuration: {
  proxyHost: '45.147.180.108',
  proxyPort: '8000',
  proxyUsername: 'gZcAuu',
  proxyEnabled: true
}
```

Если видите предупреждение о неправильном IP, значит переменные окружения все еще перекрывают дефолтные значения.

