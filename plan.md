📋 План реализации: MTProto Proxy SPA (sos-proxy)
🏗 Архитектура
Frontend: Next.js (Pages Router), Tailwind CSS, Lucide React.
Backend: Next.js API Routes (Serverless).
Database: Upstash Redis (30MB Free Tier).
Deployment: Vercel (с поддержкой Cron Jobs).
🛠 Текущий статус
 Инициализация проекта Next.js.
 Установка зависимостей (@upstash/redis, qrcode.react, p-limit, lucide-react).
 Настройка Tailwind CSS и PostCSS.
 Создание API эндпоинтов (cron-fetch, check-ping, get-proxies).
 Создание основного интерфейса в pages/index.tsx.
📂 Структура файлов
pages/api/cron-fetch.ts: Загрузка списка с GitHub и дедупликация.
pages/api/check-ping.ts: TCP-проверка прокси (staggered approach, по 10 соединений).
pages/api/get-proxies.ts: Получение актуального списка из Redis.
pages/index.tsx: Главная страница с сеткой прокси и QR-кодами.
vercel.json: Конфигурация Cron (запуск раз в неделю).
🚀 Предстоящие шаги (Deployment)
Настройка Environment Variables в Vercel:
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
Первый запуск:
Открыть /api/cron-fetch в браузере для первичного наполнения БД.
Нажать кнопку "Update Status" на главной странице для запуска пинга.
Проверка Cron:
Убедиться, что в панели Vercel во вкладке "Cron" отображается задача.
⚠️ Риски и решения
Vercel Timeout (10s): Функция check-ping ограничена проверкой 40-50 прокси за раз.
Решение: Для полной проверки большого списка требуется несколько нажатий "Update" или настройка цепочки вызовов.
TCP Blocking: Некоторые регионы/провайдеры могут блокировать TCP-запросы из Serverless функций.
Решение: Использовать Upstash в том же регионе, что и Vercel Deployment.