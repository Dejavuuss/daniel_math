// Конфигурация Firebase. Значения берутся из консоли:
// Firebase Console → Project settings → General → Your apps → Web app → SDK setup and configuration → Config.
// Эти ключи не секретные: доступ к данным защищают правила firestore.rules.
// Пока apiKey начинается с "YOUR_", сайт работает в демо-режиме на тестовых данных (см. js/demo.js).
export const firebaseConfig = {
  apiKey: "AIzaSyDDNKjqk5INorJxPHAPS4_qrm7jAEcFSgE",
  authDomain: "math-site-b8713.firebaseapp.com",
  projectId: "math-site-b8713",
  storageBucket: "math-site-b8713.firebasestorage.app",
  messagingSenderId: "165485883934",
  appId: "1:165485883934:web:b284932275f7abb040340f"
};



// Firebase Auth входит по e-mail, а в кабинете используются логины.
// Логин превращается в служебный адрес login@USERNAME_DOMAIN (письма на него не отправляются).
// Должен совпадать с USERNAME_DOMAIN в migration/import.mjs.
export const USERNAME_DOMAIN = "math-tutor.example";

// Адрес Cloudflare Worker ассистента (worker/src/index.js), вида https://math-assistant.<поддомен>.workers.dev
// Пустая строка — кнопка ассистента скрыта.
export const ASSISTANT_URL = "https://math-assistant.math-assistant-worker.workers.dev/";
