RU: Финальная полировка (FROZEN UI Protection & Cron Compensation Fix) | EN: Final Polish (FROZEN UI Protection & Cron Compensation Fix)

### What's New
* **FROZEN UI Protection**: The 'Start' and 'Restart' buttons on the process details page are now safely disabled and greyed out when a process hits the `max_restarts` limit and enters the `FROZEN` state, guiding the user to press 'Reset' instead.
* **Extended Smart Compensation**: The cron scheduler's compensation window has been massively extended from 60 minutes to 31 days. The panel effortlessly detects and fires scheduled tasks that were missed during long server downtimes.

### Что нового
* **Защита интерфейса (FROZEN)**: Кнопки 'Start' и 'Restart' на детальной странице процесса теперь интеллектуально блокируются, если процесс перешел в замороженное состояние (FROZEN) из-за превышения числа рестартов. Это предотвращает ошибочные нажатия и направляет пользователя на сброс (Reset).
* **Улучшенная Smart Компенсация**: Глубина сканирования пропущенных задач планировщика увеличена с 60 минут до 31 дня. Если сервер был выключен несколько часов или дней, система корректно вычислит и запустит пропущенную задачу при старте.
