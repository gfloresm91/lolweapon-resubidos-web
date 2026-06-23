import { expect, test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(import.meta.dirname, ".auth/user.json");

setup("autenticar usuario de prueba", async ({ page, request }) => {
  const login = process.env.PLAYWRIGHT_ADMIN_LOGIN;
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

  if (!login || !password) {
    throw new Error("Faltan PLAYWRIGHT_ADMIN_LOGIN o PLAYWRIGHT_ADMIN_PASSWORD en el entorno.");
  }

  // Usar page.request para que las cookies queden en el contexto del navegador
  const response = await page.request.post("http://localhost:3000/api/login", {
    data: { login, password },
  });

  expect(response.ok()).toBeTruthy();

  // Navegar y guardar el estado con las cookies de sesión
  await page.goto("http://localhost:3000/inicio");
  await page.waitForLoadState("load");
  await page.context().storageState({ path: authFile });
});
