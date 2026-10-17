# Кабинет репетитора по математике

Личные кабинеты ученика, родителя и репетитора: материалы, домашние задания, оценки, заметки с занятий, расписание, платежи, достижения и сообщения.

- **Фронтенд** — статические страницы без сборки (`*.html`, `css/`, `js/`), публикуются на GitHub Pages или Firebase Hosting.
- **Бэкенд** — Firebase: вход через Firebase Authentication, данные в Cloud Firestore, права доступа — в [firestore.rules](firestore.rules).
- **Дизайн** — «Ночной музей»: тёмная тема, палитра пигментов старых мастеров, в каждом кабинете — анимированная гравюра по мотивам шедевра с математической идеей (Леонардо, Дюрер, Хокусай, Рафаэль).

## Посмотреть без настройки (демо-режим)

Пока в [js/firebase-config.js](js/firebase-config.js) не вписан настоящий ключ, сайт работает на тестовых данных, которые хранятся в вашем браузере. Страницы — ES-модули, поэтому открывать их нужно через локальный сервер, а не двойным щелчком:

```bash
python -m http.server 8000
```

Откройте http://localhost:8000 и войдите как `teacher`, `ivan` или `parent_ivan` с любым паролем. Сбросить демо-данные: в консоли браузера `localStorage.removeItem("tutor_demo_db")`.

## Подключение Firebase

1. **Проект.** [console.firebase.google.com](https://console.firebase.google.com) → *Create a project*. Google Analytics не нужен. Тариф Spark (бесплатный) подходит.
2. **Вход.** *Build → Authentication → Get started → Sign-in method → Email/Password* → включите первый переключатель.
3. **База.** *Build → Firestore Database → Create database* → Standard edition, регион поближе (например, `eur3`), режим *production*.
4. **Ключи сайта.** *Project settings → General → Your apps → Web (`</>`)* → зарегистрируйте приложение и скопируйте объект `firebaseConfig` в [js/firebase-config.js](js/firebase-config.js). Эти ключи не секретные — данные защищают правила.
5. **Правила доступа.** Либо через консоль: *Firestore → Rules* → вставьте содержимое [firestore.rules](firestore.rules) → *Publish*. Либо через CLI:
   ```bash
   npx -y firebase-tools@latest login
   npx -y firebase-tools@latest use --add          # выберите проект
   npx -y firebase-tools@latest deploy --only firestore:rules
   ```
6. **Данные** — перенесите из Google Sheets (следующий раздел) или создайте репетитора вручную:
   *Authentication → Users → Add user*: e-mail `teacher@math-tutor.example`, пароль от 6 символов → скопируйте *User UID*.
   *Firestore → Start collection* `users` → документ с ID `teacher` и полями: `username` = `teacher`, `uid` = скопированный UID, `name` = ваше имя, `role` = `admin`, `grade` = `null`, `child` = `""` (пустая строка).
   Учеников и родителей дальше заводите в панели репетитора, вкладка «Аккаунты».

Логин превращается в служебный адрес `логин@math-tutor.example` — письма на него не отправляются. Домен задан в `USERNAME_DOMAIN` в [js/firebase-config.js](js/firebase-config.js) и [migration/import.mjs](migration/import.mjs); если меняете — меняйте в обоих местах до создания аккаунтов.

## Перенос данных из Google Sheets

1. В Apps Script-проекте таблицы создайте файл с кодом из [migration/export-sheets.gs](migration/export-sheets.gs) и запустите `exportForFirebase`. В журнале появится ссылка на `sheets-export-….json` — скачайте его в папку `migration/` под именем `sheets-export.json`.
2. *Project settings → Service accounts → Generate new private key* — сохраните как `migration/service-account.json`. **Это полный доступ к проекту: не коммитьте и не пересылайте файл** (он уже в `.gitignore`).
3. Запустите:
   ```bash
   cd migration
   npm install
   npm run dry-run      # покажет, что будет перенесено, ничего не записывая
   npm run import
   ```
   Пароли сохранятся прежними. Пароли короче 6 символов Firebase не принимает — скрипт заменит их и напечатает новые.
4. Удалите `sheets-export.json` (в нём пароли открытым текстом) и `service-account.json`.

Старый бэкенд лежит в [legacy/Code.gs](legacy/Code.gs) — он больше не нужен, после проверки нового сайта Apps Script-деплой можно отключить.

## Публикация

- **GitHub Pages** — как раньше: файлы в корне публикуемой ветки.
- **Firebase Hosting** (по желанию, тот же проект): `npx -y firebase-tools@latest deploy --only hosting` — сайт появится на `https://<project-id>.web.app`. Служебные папки (`migration/`, `tests/`, `legacy/`, `worker/`) не публикуются — см. `ignore` в [firebase.json](firebase.json).

## Ассистент «Смотритель»

Кнопка чата «Смотритель» есть в правом нижнем углу всех страниц. Ассистент отвечает посетителям про занятия, цены и запись и помогает с задачами школьной математики. Ответы даёт языковая модель через [OpenRouter](https://openrouter.ai), а между сайтом и OpenRouter стоит бесплатный Cloudflare Worker [worker/src/index.js](worker/src/index.js). Схема такая: страница отправляет вопрос воркеру, воркер добавляет инструкцию и сведения о занятиях и обращается к OpenRouter. Ключ OpenRouter хранится только в секретах Cloudflare. К кабинетам и данным учеников у ассистента доступа нет. Карта не нужна: бесплатный план Cloudflare даёт 100 000 запросов в сутки.

**Модель.** Сейчас используются бесплатные модели OpenRouter — цепочка `MODELS` в начале [worker/src/index.js](worker/src/index.js). Если первая модель перегружена, OpenRouter сам пробует следующую. У бесплатных моделей два ограничения:
- **50 запросов в сутки и 20 в минуту на весь аккаунт OpenRouter.** Лимит общий с другими проектами на этом аккаунте, например с Telegram-ботом. Если купить кредиты на $10, лимит вырастет до 1000 запросов в сутки.
- **Ответы проще, чем у платных моделей.** Бесплатная модель хуже держит правило «сначала подсказка» и иногда сразу решает задачу.

Чтобы перейти на платную модель, пополните баланс на openrouter.ai/credits и замените `MODELS` на `["anthropic/claude-haiku-5.5"]`. Это примерно 0,05 ₽ за ответ. После замены задеплойте воркер заново.

**Подключение (один раз):**

1. **Аккаунт Cloudflare.** Зарегистрируйтесь на https://dash.cloudflare.com/sign-up — бесплатно, без карты.
2. **Сведения о занятиях.** Заполните [worker/tutor-info.md](worker/tutor-info.md): цены, формат, расписание и обязательно реальные контакты. Ассистент отвечает только по этому файлу. Всё, что записано в квадратных скобках, он считает неизвестным и предлагает уточнить у вас.
3. **Вход, хранилище, ключ и деплой** — выполняйте в папке `worker`:
   ```bash
   cd worker
   npm install
   npx wrangler login                              # откроется браузер — нажмите Allow
   npx wrangler kv namespace create LIMITS         # выведет id — впишите его в wrangler.toml вместо REPLACE_WITH_KV_NAMESPACE_ID
   npx wrangler secret put OPENROUTER_API_KEY      # вставьте ключ sk-or-…
   npx wrangler deploy                             # выведет адрес https://math-assistant.<поддомен>.workers.dev
   ```
4. Вставьте адрес из последней команды в `ASSISTANT_URL` в [js/firebase-config.js](js/firebase-config.js) и опубликуйте сайт. Пока `ASSISTANT_URL` пустой, кнопка ассистента скрыта.

**Защита.** Ассистент открыт всем, поэтому воркер:
- принимает запросы только с вашего сайта (`ALLOWED_ORIGINS`);
- пропускает не больше 10 сообщений в час с одного адреса и 30 в сутки со всего сайта (`PER_DAY`), чтобы сайт не съел всю бесплатную квоту OpenRouter и вашему боту остались запросы. Счётчики хранятся в Workers KV;
- ограничивает вопрос 1000 символами, а историю — 12 последними репликами;
- убирает из ответа разметку Markdown и LaTeX, которую модели иногда вставляют: окно чата показывает обычный текст.

**Если сменили `tutor-info.md`** или настройки в `worker/src/index.js`, выполните в папке `worker` команду `npx wrangler deploy`.

**Проверка у себя:** впишите ключ в `worker/.dev.vars` (`OPENROUTER_API_KEY=sk-or-…`; файл исключён из git) и выполните `npx wrangler dev`. Воркер запустится на http://127.0.0.1:8787.

## Аккаунты и пароли

- Репетитор создаёт учеников и родителей во вкладке «Аккаунты» — пароль задаётся при создании.
- Сменить пароль, отключить или удалить аккаунт — *Firebase Console → Authentication → Users*. Удалите и документ `users/<логин>` в Firestore: без него вход в кабинет невозможен.
- Пароли хранит Firebase Authentication в зашифрованном виде; в базе их больше нет.

## Тесты правил доступа

Правила проверяются на эмуляторе Firestore (нужна Java 21+):

```bash
cd tests
npm install
npm test
```

Тесты повторяют запросы, которые делает [js/auth.js](js/auth.js), и пробуют обойти права: чужие данные, подмену роли, подделку отправителя, некорректные поля.

## Безопасность

Доступ проверяется на стороне Firebase правилами [firestore.rules](firestore.rules): ученик видит только свои записи, родитель — записи своего ребёнка, менять данные может только репетитор (ученик и родитель — лишь отметку о выполнении задания и прочтении сообщений). Админа нельзя создать из приложения — только в консоли или скриптом миграции. Правила — проверенный тестами прототип; перед тем как раздавать доступ большому числу людей, стоит ещё раз их просмотреть.

## Структура

| Путь | Что это |
|---|---|
| `index.html`, `dashboard.html`, `parent.html`, `admin.html` | Вход и кабинеты ученика, родителя, репетитора |
| `js/auth.js` | Слой данных: вход, `apiGet` / `apiPost`, Firebase или демо |
| `js/firebase-config.js` | Ключи проекта Firebase |
| `js/demo.js` | Тестовые данные для демо-режима |
| `js/fx.js`, `js/art.js` | Движение (свет, пыль, появление) и анимированные гравюры |
| `js/ui.js`, `js/calendar.js` | Общие элементы интерфейса и календарь |
| `css/style.css` | Все стили, тёмная и светлая темы |
| `js/assistant.js` | Чат-виджет «Смотритель» |
| `worker/` | Cloudflare Worker ассистента (OpenRouter) и сведения о занятиях для него |
| `firestore.rules`, `firebase.json` | Правила доступа и настройки Firebase |
| `migration/` | Перенос данных из Google Sheets |
| `tests/` | Тесты правил на эмуляторе |
| `legacy/Code.gs` | Прежний бэкенд на Apps Script |
