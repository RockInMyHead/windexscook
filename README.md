# 🍳 Windexs Cook - AI-Powered Recipe Generator

Интеллектуальный помощник по приготовлению блюд с использованием GPT-4 и ElevenLabs.

## 🌟 Возможности

- 🤖 **AI Генерация рецептов** - создание уникальных рецептов из ваших ингредиентов
- 📸 **Анализ изображений** - распознавание ингредиентов по фото
- 💬 **AI Чат-повар** - консультации с виртуальным шеф-поваром
- 🌍 **40+ кухонь мира** - от японской до марокканской
- 🥗 **Персонализация** - учет диет, аллергий и предпочтений
- 🎙️ **Голосовое управление** - с поддержкой ElevenLabs TTS
- 📊 **Анализ калорий** - расчет питательной ценности блюд

## 🚀 Быстрый старт

### Локальная разработка

```bash
# Клонировать репозиторий
git clone https://github.com/RockInMyHead/windexscook.git
cd windexscook

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Отредактируйте .env и добавьте ваши API ключи

# Запустить сервер разработки
npm run dev
```

### Production деплой

```bash
# Сделать скрипт исполняемым
chmod +x deploy.sh

# Запустить деплой
./deploy.sh
```

## 🔑 Переменные окружения

Создайте файл `.env` в корне проекта:

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
PORT=1041
```

## 📦 Технологии

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend**: Express.js, Node.js
- **AI**: OpenAI GPT-4, ElevenLabs
- **Deployment**: PM2, Nginx, Docker

## 🛠️ Команды

```bash
npm run dev          # Запуск в режиме разработки
npm run build        # Сборка production версии
npm run server       # Запуск сервера
npm run preview      # Предпросмотр production сборки
```

## 🌐 Деплой

Приложение развернуто на:
- **URL**: http://cook.windexs.ru:1031
- **Server**: 37.110.51.35:1030

### Управление на сервере

```bash
# Подключение к серверу
ssh svr@37.110.51.35 -p 1030

# PM2 команды
pm2 status                    # Статус приложений
pm2 logs windex-cook          # Логи приложения
pm2 restart windex-cook       # Перезапуск
pm2 stop windex-cook          # Остановка
pm2 monit                     # Мониторинг в реальном времени

# Nginx
sudo nginx -t                 # Проверка конфигурации
sudo systemctl reload nginx   # Перезагрузка Nginx
sudo systemctl status nginx   # Статус Nginx
```

## 📝 Структура проекта

```
windexscook/
├── src/
│   ├── components/        # React компоненты
│   │   ├── ui/           # UI компоненты (shadcn/ui)
│   │   └── ...           # Секции страниц
│   ├── pages/            # Страницы приложения
│   ├── services/         # API сервисы
│   ├── types/            # TypeScript типы
│   └── contexts/         # React контексты
├── public/               # Статические файлы
├── server.js             # Express сервер
├── deploy.sh             # Скрипт деплоя
└── package.json
```

## 🔒 Безопасность

- ✅ Размер запросов ограничен 50MB
- ✅ CORS настроен
- ✅ API ключи хранятся в .env
- ✅ Логирование всех запросов
- ✅ Демо-режим при отсутствии ключей

## 📄 Лицензия

MIT

## 👨‍💻 Разработка

- **GitHub**: [RockInMyHead/windexscook](https://github.com/RockInMyHead/windexscook)
- **Demo**: http://cook.windexs.ru:1031

## 🤝 Вклад

Приветствуются pull requests. Для крупных изменений сначала откройте issue.

---

Made with ❤️ and AI

