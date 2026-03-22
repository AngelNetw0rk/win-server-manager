# Win Server Manager / C2 Process Manager 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14.0.0-success)](#)

*🇷🇺 Описание на русском ниже.*

A self-hosted, standalone web panel for managing Windows Server processes, bots, and background scripts. Built with a stunning Glassmorphism UI, a built-in terminal emulator (`node-pty`), real-time OS monitoring, and Smart Over-The-Air (OTA) updates.

### ✨ Features
*   **Web Dashboard:** Beautiful Glassmorphism UI (fully optimized for Mobile & Touch).
*   **Live Terminal:** Real-time console output and input via `xterm.js` and WebSockets.
*   **Process Control:** Start, Stop, Restart, Force Kill, and Auto-Restart Watchdog.
*   **Auto-Discovery:** Just configure root folders, and the manager will auto-detect scripts.
*   **Cron Scheduler:** Timezone-aware cron tasks for each process.
*   **OTA Updates:** Smart updating via `manager.bat` with automatic DB/Logs backup.
*   **Cloudflare Tunnel:** built-in support for free HTTPS external access.

---

### 💻 Quick Auto-Install (One-Liner)
If you want to deploy this onto a new, totally clean Windows Server (no Git required), simply run this in **PowerShell as Administrator**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/AngelNetw0rk/win-server-manager/main/install.ps1'))
```
This will automatically download, unpack to `C:\WinServerManager`, and install all dependencies.

### 🛠 Manual Install & Build
1. Clone the repository:
   ```bash
   git clone https://github.com/AngelNetw0rk/win-server-manager.git
   cd win-server-manager
   ```
2. Double-click **`manager.bat`** and select **`[1] Install`**.
3. Create your Admin account during the setup.
4. Select **`[3] Start Server`** from the `manager.bat` menu.
5. Open `http://localhost:3000` in your browser for local access.
6. **(Optional)** For remote access from anywhere, select **`[6] Setup Cloudflare Tunnel`** -> `[1] Quick Tunnel`.
7. Select **`[7] Start Tunnel`** to get your public HTTPS URL!

---
---

# 🇷🇺 Win Server Manager (C2 Панель управления)

Автономная веб-панель для управления скриптами и ботами на Windows Server. Обладает сочным Glassmorphism интерфейсом, встроенным терминалом, мониторингом системы и умной системой автообновлений.

### ✨ Возможности
*   **Веб-интерфейс:** Красивый Glassmorphism дизайн (полностью адаптирован под телефоны).
*   **Встроенный терминал:** Управление процессами в реальном времени (ввод/вывод через WebSocket).
*   **Управление:** Start, Stop, Restart, Force Kill и защита от бесконечных перезапусков (Watchdog).
*   **Авто-поиск:** Укажите корневую папку в настройках, и панель сама найдет все ваши скрипты.
*   **Планировщик:** Cron-задачи с поддержкой часовых поясов для каждого процесса.
*   **Умное Обновление:** `manager.bat` умеет обновляться с GitHub, предварительно создавая бэкап базы данных.
*   **Внешний доступ:** Встроенная поддержка бесплатных туннелей Cloudflare.

---

### 💻 Быстрая авто-установка (Одной командой)
Чтобы развернуть панель на абсолютно пустом и новом Windows Server (даже без установленного Git), выполните эту команду в **PowerShell от имени Администратора**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/AngelNetw0rk/win-server-manager/main/install.ps1'))
```
Скрипт сам скачает проект, распакует его в `C:\WinServerManager` и установит зависимости.

### 🛠 Ручная установка
1. Склонируйте репозиторий:
   ```bash
   git clone https://github.com/AngelNetw0rk/win-server-manager.git
   cd win-server-manager
   ```
2. Откройте **`manager.bat`** и выберите **`[1] Install`**.
3. Задайте логин и пароль администратора.
4. Выберите **`[3] Start Server`** в меню батника.
5. Для локального доступа откройте `http://localhost:3000` в браузере.
6. **(Опционально)** Для доступа из любой точки мира выберите **`[6] Setup Cloudflare Tunnel`** -> `[1] Quick Tunnel`.
7. Выберите **`[7] Start Tunnel`**, чтобы получить вашу публичную HTTPS ссылку!
