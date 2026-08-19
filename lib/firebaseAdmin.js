import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Mismo patrón singleton que lib/prisma.js: guardado en globalThis para sobrevivir al hot-reload
// de módulos en dev. Credenciales desde FIREBASE_SERVICE_ACCOUNT_JSON (el JSON completo de la
// service account, en una sola línea) - nunca comiteada, ver .env. Import por subpath (no el
// paquete raíz "firebase-admin") - es la forma soportada en ESM para firebase-admin 14.x.

const globalForFirebase = globalThis;

/** Devuelve el cliente de Firebase Cloud Messaging, o null si el Admin SDK no está configurado. */
export function getFirebaseMessaging() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return null;
  }

  if (!globalForFirebase.__lolweaponFirebaseApp) {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    globalForFirebase.__lolweaponFirebaseApp = initializeApp({
      credential: cert(credentials),
    });
  }

  return getMessaging(globalForFirebase.__lolweaponFirebaseApp);
}
