# 🚀 Win Server Manager v1.6.8 (Core UI & Setup Fixes Phase 2)

### EN: What's New
* **Smart Rescue Mode**: The Emergency Rescue Console now intelligently distinguishes between a deliberate server shutdown (e.g. from the menu or Ctrl+C) and a crash. Intentional stops will no longer falsely trigger the rescue procedure or send Telegram downtime alerts.
* **Foolproof Session Controls**: Removed the Kick and Ban IP buttons explicitly for the user's current session in the Auth Logs tab, fully eliminating the possibility of accidental self-lockouts.

### RU: Что нового
* **Умный Rescue Mode**: Аварийная консоль (Broker) теперь отличает ручную остановку сервера (через меню или Ctrl+C) от внезапного краша. Если вы намеренно закрываете панель, экстренный батник спасения больше не появится, и ложная Telegram-тревога не сработает.
* **Защита от миссклика в сессиях**: Из вкладки логов теперь полностью убраны кнопки Kick и Ban IP для вашей текущей сессии (а не просто заблокированы), исключая любую возможность случайной самоблокировки.
