# Настройка GitHub Secrets для деплоя

## Необходимые секреты в GitHub

Перейдите в настройки репозитория: `Settings` → `Secrets and variables` → `Actions`

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

## Устранение проблем

Если получаете ошибку "The ssh-private-key argument is empty":

1. Проверьте, что секрет `SSH_PRIVATE_KEY_FOR_DEPLOY` существует
2. Убедитесь, что SSH ключ скопирован полностью
3. Проверьте, что нет лишних пробелов в начале или конце ключа
4. Убедитесь, что ключ в правильном формате OpenSSH
