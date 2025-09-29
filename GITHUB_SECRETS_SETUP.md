# Настройка GitHub Secrets для деплоя

## Необходимые секреты в GitHub

Перейдите в настройки репозитория: `Settings` → `Secrets and variables` → `Actions`

### Вариант 1: SSH_PRIVATE_KEY_FOR_DEPLOY (основной)
### 1. SSH_PRIVATE_KEY_FOR_DEPLOY
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCM1Ttv7X9d+2hBlL9IvGNdQdu1UlOL+50cGbXkyggF8wAAAJi+osFBvqLB
QQAAAAtzc2gtZWQyNTUxOQAAACCM1Ttv7X9d+2hBlL9IvGNdQdu1UlOL+50cGbXkyggF8w
AAAECobg+1hrqUg+DD9MNMl9+qNv5QLKPpN4Ho0rypdn76P4zVO2/tf137aEGUv0i8Y11B
27VSU4v7nRwZteTKCAXzAAAADmdpdEBkZXBsb3kuY29tAQIDBAUGBw==
-----END OPENSSH PRIVATE KEY-----
```

### 2. SSH_USER
```
git
```

### 3. SERVER_IP
```
IP адрес вашего сервера
```

### 4. SSH_PORT
```
22
```

## Проверка секретов

1. Убедитесь, что все секреты добавлены в репозиторий
2. Проверьте, что имена секретов точно совпадают с workflow файлом
3. Убедитесь, что SSH ключ добавлен полностью, включая заголовки

### Вариант 2: SSH_PRIVATE_KEY (альтернативный)
### 1. SSH_PRIVATE_KEY
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCM1Ttv7X9d+2hBlL9IvGNdQdu1UlOL+50cGbXkyggF8wAAAJi+osFBvqLB
QQAAAAtzc2gtZWQyNTUxOQAAACCM1Ttv7X9d+2hBlL9IvGNdQdu1UlOL+50cGbXkyggF8w
AAAECobg+1hrqUg+DD9MNMl9+qNv5QLKPpN4Ho0rypdn76P4zVO2/tf137aEGUv0i8Y11B
27VSU4v7nRwZteTKCAXzAAAADmdpdEBkZXBsb3kuY29tAQIDBAUGBw==
-----END OPENSSH PRIVATE KEY-----
```

## Устранение проблем

Если получаете ошибку "The ssh-private-key argument is empty":

1. **Попробуйте оба варианта имен секретов:**
   - `SSH_PRIVATE_KEY_FOR_DEPLOY` (основной)
   - `SSH_PRIVATE_KEY` (альтернативный)

2. **Проверьте секреты:**
   - Убедитесь, что секрет существует
   - SSH ключ скопирован полностью
   - Нет лишних пробелов в начале или конце ключа
   - Ключ в правильном формате OpenSSH

3. **Используйте debug информацию:**
   - Workflow покажет, какие секреты найдены
   - Проверьте логи GitHub Actions
