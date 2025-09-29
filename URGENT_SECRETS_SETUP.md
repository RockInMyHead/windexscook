# 🚨 СРОЧНО: Настройка секретов в GitHub

## Проблема
Debug показывает, что ВСЕ секреты пустые:
```
SSH_PRIVATE_KEY exists: false
SSH_PRIVATE_KEY_FOR_DEPLOY exists: false
SSH_USER: 
SERVER_IP: 
SSH_PORT: 
```

## Решение: Добавить секреты в GitHub

### Шаг 1: Перейдите в настройки репозитория
1. Откройте ваш репозиторий: `https://github.com/RockInMyHead/windexscook`
2. Нажмите **Settings** (вкладка справа)
3. В левом меню выберите **Secrets and variables** → **Actions**

### Шаг 2: Добавьте ВСЕ необходимые секреты

#### 1. SSH_PRIVATE_KEY_FOR_DEPLOY
- **Name:** `SSH_PRIVATE_KEY_FOR_DEPLOY`
- **Value:** 
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCM1Ttv7X9d+2hBlL9IvGNdQdu1UlOL+50cGbXkyggF8wAAAJi+osFBvqLB
QQAAAAtzc2gtZWQyNTUxOQAAACCM1Ttv7X9d+2hBlL9IvGNdQdu1UlOL+50cGbXkyggF8w
AAAECobg+1hrqUg+DD9MNMl9+qNv5QLKPpN4Ho0rypdn76P4zVO2/tf137aEGUv0i8Y11B
27VSU4v7nRwZteTKCAXzAAAADmdpdEBkZXBsb3kuY29tAQIDBAUGBw==
-----END OPENSSH PRIVATE KEY-----
```

#### 2. SSH_PRIVATE_KEY (дубликат)
- **Name:** `SSH_PRIVATE_KEY`
- **Value:** (тот же ключ что выше)

#### 3. SSH_USER
- **Name:** `SSH_USER`
- **Value:** `git`

#### 4. SERVER_IP
- **Name:** `SERVER_IP`
- **Value:** `ВАШ_IP_АДРЕС_СЕРВЕРА`

#### 5. SSH_PORT
- **Name:** `SSH_PORT`
- **Value:** `22`

### Шаг 3: Проверьте секреты
После добавления всех секретов:
1. Убедитесь, что все 5 секретов видны в списке
2. Проверьте, что имена точно совпадают (регистр важен!)
3. Убедитесь, что SSH ключ скопирован полностью

### Шаг 4: Запустите workflow снова
После настройки секретов:
1. Сделайте любой коммит (например, измените README)
2. Или перезапустите workflow в GitHub Actions
3. Debug должен показать `exists: true` для всех секретов

## ⚠️ ВАЖНО
- Имена секретов должны точно совпадать
- SSH ключ должен включать заголовки `-----BEGIN` и `-----END`
- Нет лишних пробелов в начале/конце
- Все секреты должны быть добавлены в репозиторий
