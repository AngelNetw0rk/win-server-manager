# Win Server Manager (C2 Web Panel)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14.0.0-success)](#)
[![Version](https://img.shields.io/badge/Version-v1.1.0-orange)](#)

*🇷🇺 [Русская документация ниже](#-win-server-manager-c2-панель)*

**The ultimate standalone C2 Web Panel for Windows Server.** Manage your bots, automated scripts, and background processes with zero friction and a stunning Glassmorphism UI. Fully optimized for Mobile & Telegram Mini Apps (TMA).

### Why Win Server Manager?
* **Zero-Dependency Install**: Deploy on a fresh Windows Server in 1 click using PowerShell.
* **Mobile-First Glassmorphism UI**: Beautiful, responsive design with smooth Apple-style animations.
* **Secure Access Anywhere**: Built-in Cloudflare Tunnels and Telegram Auth validation.
* **Smart OTA Updates**: Pull latest updates directly from GitHub without losing your configs or DB.

### Core Features
* **Grid Multi-Terminals**: Run 1, 2, or 4 live interactive terminals (PTY) simultaneously on one screen.
* **Auto-Discovery**: Just set your root directories, and the manager will detect and list all your script folders.
* **Advanced Cron Scheduler**: Timezone-aware, "Every N days" intervals, and randomized startup delays to mimic human behavior.
* **Process Watchdog**: Start, Stop, Force Kill, and Auto-Restart failed background scripts automatically.
* **Real-time Metrics**: Live CPU, RAM, and Network I/O monitoring.

---

### 1-Click Auto Install (Recommended)
Deploy onto a completely clean Windows Server (no Git, no Node.js required). Run this in **PowerShell as Administrator**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AngelNetw0rk/win-server-manager/main/install.ps1" -OutFile "$env:TEMP\wsm_install.ps1"; & "$env:TEMP\wsm_install.ps1"
```
*(Downloads the project, unpacks to `C:\WinServerManager`, and installs all dependencies.)*

### Manual Setup
1. Clone the repo: `git clone https://github.com/AngelNetw0rk/win-server-manager.git`
2. Run **`manager.bat`** and select **`[1] Install`**.
3. Create your Admin account.
4. Select **`[3] Start Server`** and open `http://localhost:3000`.
5. *(Optional)* Need remote access? Select **`[6] Setup Cloudflare Tunnel`** to get your public HTTPS URL!

---
---

# Win Server Manager (C2 Панель)

**Мощная и автономная веб-панель для Windows Server.** Управляйте своими ботами, авторег-скриптами и фоновыми процессами через шикарный Glassmorphism интерфейс, идеально работающий как на ПК, так и в Telegram Mini App.

### Почему именно эта панель?
* **Установка "В один клик"**: Разворачивается на чистом Windows Server одной консольной командой (Git не нужен).
* **Премиальный дизайн**: Сочный Glassmorphism UI с быстрыми анимациями и 100% адаптацией под смартфоны.
* **Безопасный доступ**: Встроенная поддержка бесплатных туннелей Cloudflare и TMA авторизация через Telegram.
* **Умные Автообновления (OTA)**: Обновление по воздуху прямо с GitHub без потери вашей базы данных и настроек.

### Главные фичи
* **Мульти-терминалы**: Интерактивные консоли в реальном времени с раскладкой "Сеткой" (1, 2 или 4 окна).
* **Авто-поиск (Auto-Discovery)**: Укажите корневые папки, и панель сама найдет все ваши софты.
* **Умный Планировщик (Cron)**: Интервалы "Каждые N дней", рандомизация минут (защита от антифрода) и полная поддержка часовых поясов.
* **Управление процессами**: Start, Stop, Kill, автоматический рестарт при падении и сохранение краш-логов.
* **Мониторинг**: Живое отображение нагрузки на CPU, ОЗУ и скорость интернета.

---

### Быстрая авто-установка (Рекомендуется)
Полностью автоматизированный деплой для чистого сервера. Выполните в **PowerShell от имени Администратора**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AngelNetw0rk/win-server-manager/main/install.ps1" -OutFile "$env:TEMP\wsm_install.ps1"; & "$env:TEMP\wsm_install.ps1"
```

### Ручная установка
1. Скачайте репозиторий: `git clone https://github.com/AngelNetw0rk/win-server-manager.git`
2. Запустите **`manager.bat`** и выберите **`[1] Install`**.
3. Придумайте логин и пароль администратора.
4. Выберите **`[3] Start Server`** и откройте `http://localhost:3000`.
5. *(Опционально)* Нужен доступ без белого IP? Жмите **`[6] Setup Cloudflare Tunnel`** и получите HTTPS-ссылку!
