import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// Viewports representativos para responsivo
const RESPONSIVE_VIEWPORTS = [
  { name: "mobile",   width: 390,  height: 844 },
  { name: "desktop",  width: 1280, height: 900 },
];

// Selector del botón notificar en LiveCard (cómodo y tabla rastreador público)
const NOTIFY_BTN = ".platform-notify";

async function mockNotifySuccess(page) {
  await page.route("**/api/lives/*/notify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, notifiedAt: "2026-06-28T12:00:00.000Z" }),
    });
  });
}

// ── API: autenticación ────────────────────────────────────────────────────────

test("API /api/lives/[id]/notify — 401 sin sesión", async ({ playwright }) => {
  // Contexto limpio sin cookies: forzamos storageState vacío
  const noAuth = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const res = await noAuth.post(`${BASE_URL}/api/lives/1/notify`);
  await noAuth.dispose();
  expect(res.status()).toBe(401);
});

test("API /api/lives/[id]/notify — 403 con sesión sin permiso", async ({ playwright }) => {
  const login = process.env.PLAYWRIGHT_NO_NOTIFY_LOGIN;
  const password = process.env.PLAYWRIGHT_NO_NOTIFY_PASSWORD;
  test.skip(!login || !password, "Requiere credenciales locales de un usuario sin permisos de notificación.");

  const noPermission = await playwright.request.newContext();
  const loginResponse = await noPermission.post(`${BASE_URL}/api/login`, {
    data: { login, password },
  });
  const loginData = await loginResponse.json();
  expect(loginResponse.ok(), `Login rechazado (${loginResponse.status()}): ${loginData.error || "sin detalle"}`).toBeTruthy();

  const response = await noPermission.post(`${BASE_URL}/api/lives/1/notify`);
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ error: "Permiso insuficiente" });
  await noPermission.dispose();
});

test("API /api/lives/[id]/notify — 400 con ID inválido", async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/lives/id-invalido/notify`);
  expect(res.status()).toBe(400);
  await expect(res.json()).resolves.toMatchObject({ error: "ID inválido." });
});

test("API /api/lives/[id]/notify — 404 con directo inexistente", async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/lives/2147483647/notify`);
  expect(res.status()).toBe(404);
  await expect(res.json()).resolves.toMatchObject({ error: "Directo no encontrado." });
});

// ── Rastreador público — vista cómoda ─────────────────────────────────────────

test("Rastreador cómodo — botón notificar visible para usuario con permiso", async ({ page }) => {
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");

  const btn = page.locator(NOTIFY_BTN).first();
  await expect(btn).toBeVisible({ timeout: 10000 });
});

test("Rastreador cómodo — cancelar no envía notificación", async ({ page }) => {
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");

  const btn = page.locator(NOTIFY_BTN).first();
  await expect(btn).toBeVisible({ timeout: 10000 });

  await btn.click();
  const modal = page.locator(".confirm-modal");
  await expect(modal).toBeVisible({ timeout: 5000 });

  const titleText = await modal.locator(".modal-title").textContent();
  expect(["Notificar resubido", "Reenviar notificación"]).toContain(titleText?.trim());

  const ariaLabelBefore = await btn.getAttribute("aria-label");

  await modal.locator(".btn-modal-secondary").click();
  await expect(modal).not.toBeVisible({ timeout: 3000 });

  // El estado no cambió tras cancelar
  await expect(btn).toHaveAttribute("aria-label", ariaLabelBefore);
});

test("Rastreador cómodo — flujo completo: notificar cambia estado del botón", async ({ page }) => {
  await mockNotifySuccess(page);
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");

  const btn = page.locator(NOTIFY_BTN).first();
  await expect(btn).toBeVisible({ timeout: 10000 });

  const ariaLabelBefore = await btn.getAttribute("aria-label");
  const isResend = ariaLabelBefore?.includes("Reenviar");

  await btn.click();
  const modal = page.locator(".confirm-modal");
  await expect(modal).toBeVisible({ timeout: 5000 });

  const confirmBtn = modal.locator(".btn-modal-primary, .btn-modal-danger").last();
  const confirmText = await confirmBtn.textContent();
  expect(isResend ? "Sí, reenviar" : "Notificar").toBe(confirmText?.trim());

  const notifyResponse = page.waitForResponse(
    (r) => r.url().includes("/notify") && r.request().method() === "POST",
    { timeout: 10000 },
  );
  await confirmBtn.click();
  const res = await notifyResponse;
  expect(res.status()).toBe(200);

  await expect(modal).not.toBeVisible({ timeout: 5000 });

  // El botón ahora siempre muestra "Reenviar" (independiente del estado inicial)
  const ariaLabelAfter = await btn.getAttribute("aria-label");
  expect(ariaLabelAfter).toContain("Reenviar");
});

// ── Rastreador público — vista tabla ──────────────────────────────────────────

test("Rastreador tabla — botón notificar visible en vista tabla", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");

  // Cambiar a vista tabla (botón con texto "Tabla")
  const tableBtn = page.locator(".density-table-option");
  await expect(tableBtn).toBeVisible({ timeout: 10000 });
  await tableBtn.click();

  // Esperar a que el grid de tabla esté visible
  const tableGrid = page.locator(".lives-grid-table");
  await expect(tableGrid).toBeVisible({ timeout: 5000 });

  // El botón notificar debe aparecer dentro de la vista tabla
  const notifyInTable = tableGrid.locator(NOTIFY_BTN).first();
  await expect(notifyInTable).toBeVisible({ timeout: 5000 });
});

test("Rastreador tabla — disponibilidad no se solapa con acciones en tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1080 });
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tabla" }).click();

  const scroll = page.locator(".lives-compact-shell");
  const row = page.locator(".lives-grid-compact .live-card", {
    has: page.locator(".availability-chip-okru"),
  }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await scroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  const columnsDoNotOverlap = await row.evaluate((element) => {
    const availabilityRect = element.querySelector(".availability-row").getBoundingClientRect();
    const actionsRect = element.querySelector(".links-container").getBoundingClientRect();
    return availabilityRect.right <= actionsRect.left + 1;
  });
  expect(columnsDoNotOverlap).toBe(true);
});

// ── Vista compacta — sin botón notificar ─────────────────────────────────────

test("Rastreador compacto — NO muestra botón notificar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");

  // Cambiar a vista compacta
  const compactBtn = page.locator("button", { hasText: "Compacto" });
  await expect(compactBtn).toBeVisible({ timeout: 10000 });
  await compactBtn.click();

  // Esperar el re-render
  await page.waitForLoadState("networkidle");

  const notifyBtns = page.locator(NOTIFY_BTN);
  await expect(notifyBtns).toHaveCount(0);
});

test("Mi lista — NO muestra acciones para notificar", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1080 });
  await page.goto(`${BASE_URL}/mi-lista`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(NOTIFY_BTN)).toHaveCount(0);

  const card = page.locator(".lives-grid-comfortable .live-card").first();
  if (await card.count()) {
    const layout = await card.evaluate((element) => {
      const actions = element.querySelector(".links-container");
      const detail = element.querySelector(".platform-detail");
      return {
        buttonCount: actions.querySelectorAll("button").length,
        columns: getComputedStyle(actions).gridTemplateColumns.split(" ").length,
        detailWidth: detail.getBoundingClientRect().width,
      };
    });
    expect(layout.buttonCount).toBe(4);
    expect(layout.columns).toBe(4);
    expect(layout.detailWidth).toBeGreaterThan(150);
  }
});

test("Rastreador cómodo móvil — acciones en una sola fila y ancho uniforme", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1080 });
  await page.goto(`${BASE_URL}/rastreador`);
  await page.waitForLoadState("networkidle");

  const card = page.locator(".lives-grid-comfortable .live-card").first();
  await expect(card).toBeVisible({ timeout: 10000 });
  const layout = await card.evaluate((element) => {
    const actions = element.querySelector(".links-container");
    const buttons = [...actions.querySelectorAll("button")];
    const rects = buttons.map((button) => button.getBoundingClientRect());
    return {
      buttonCount: buttons.length,
      rowSpread: Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)),
      widthSpread: Math.max(...rects.map((rect) => rect.width)) - Math.min(...rects.map((rect) => rect.width)),
      detailLabel: element.querySelector(".platform-detail")?.getAttribute("aria-label") || "",
    };
  });

  expect(layout.buttonCount).toBe(5);
  expect(layout.rowSpread).toBeLessThanOrEqual(1);
  expect(layout.widthSpread).toBeLessThanOrEqual(1);
  expect(layout.detailLabel).toMatch(/^Ver (ficha|links|resubido)$/);
});

// ── Admin rastreador ──────────────────────────────────────────────────────────

test("Admin rastreador — columna Notificado visible", async ({ page }) => {
  await page.goto(`${BASE_URL}/administracion/rastreador`);
  await page.waitForLoadState("networkidle");

  // El header usa <span> dentro de .maintainer-table-head, no <th>
  const header = page.locator(".maintainer-table-head span", { hasText: "Notificado" });
  await expect(header).toBeVisible({ timeout: 10000 });
});

test("Admin rastreador — botón notificar en fila y flujo cancelar", async ({ page }) => {
  await page.goto(`${BASE_URL}/administracion/rastreador`);
  await page.waitForLoadState("networkidle");

  // Las filas usan .admin-tracker-row (divs con role="row"), no <tr>
  const rows = page.locator(".admin-tracker-row");
  await expect(rows.first()).toBeVisible({ timeout: 10000 });

  const notifyBtnInRow = rows.first().locator('[aria-label="Notificar resubido"], [aria-label="Reenviar notificación"]');
  await expect(notifyBtnInRow).toBeVisible({ timeout: 5000 });

  const ariaLabelBefore = await notifyBtnInRow.getAttribute("aria-label");

  await notifyBtnInRow.click();
  const modal = page.locator(".confirm-modal");
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Cancelar
  await modal.locator(".btn-modal-secondary").click();
  await expect(modal).not.toBeVisible({ timeout: 3000 });

  // El estado no cambió
  await expect(notifyBtnInRow).toHaveAttribute("aria-label", ariaLabelBefore);
});

test("Admin rastreador — acciones completas al final del scroll horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/administracion/rastreador`);
  await page.waitForLoadState("networkidle");

  const scroll = page.locator(".admin-tracker-table .maintainer-table-scroll");
  const actions = page.locator(".admin-tracker-row .admin-user-actions").first();
  await expect(actions).toBeVisible({ timeout: 10000 });

  await scroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  const geometry = await actions.evaluate((element) => {
    const actionsRect = element.getBoundingClientRect();
    const scrollRect = element.closest(".maintainer-table-scroll").getBoundingClientRect();
    const buttonsFit = [...element.querySelectorAll("button")].every((button) => {
      const buttonRect = button.getBoundingClientRect();
      return buttonRect.left >= scrollRect.left - 1 && buttonRect.right <= scrollRect.right + 1;
    });

    return {
      fits: actionsRect.left >= scrollRect.left - 1
        && actionsRect.right <= scrollRect.right + 1
        && buttonsFit,
      actionsLeft: Math.round(actionsRect.left),
      actionsRight: Math.round(actionsRect.right),
      scrollLeft: Math.round(scrollRect.left),
      scrollRight: Math.round(scrollRect.right),
      rowWidth: Math.round(element.closest(".admin-tracker-row").getBoundingClientRect().width),
      tableWidth: Math.round(element.closest(".maintainer-table").getBoundingClientRect().width),
      columns: getComputedStyle(element.closest(".admin-tracker-row")).gridTemplateColumns,
    };
  });
  expect(geometry.fits, JSON.stringify(geometry)).toBe(true);
});

test("Admin rastreador — confirmar notificación actualiza columna Notificado", async ({ page }) => {
  await mockNotifySuccess(page);
  await page.goto(`${BASE_URL}/administracion/rastreador`);
  await page.waitForLoadState("networkidle");

  const rows = page.locator(".admin-tracker-row");
  await expect(rows.first()).toBeVisible({ timeout: 10000 });

  const firstRow = rows.first();
  const notifyBtn = firstRow.locator('[aria-label="Notificar resubido"], [aria-label="Reenviar notificación"]');
  await expect(notifyBtn).toBeVisible({ timeout: 5000 });

  await notifyBtn.click();
  const modal = page.locator(".confirm-modal");
  await expect(modal).toBeVisible({ timeout: 5000 });

  const confirmBtn = modal.locator(".btn-modal-primary, .btn-modal-danger").last();

  const notifyResponse = page.waitForResponse(
    (r) => r.url().includes("/notify") && r.request().method() === "POST",
    { timeout: 10000 },
  );
  await confirmBtn.click();
  const res = await notifyResponse;
  expect(res.status()).toBe(200);

  await expect(modal).not.toBeVisible({ timeout: 5000 });

  // La celda Notificado ya no tiene el span .is-empty con "—"
  const notifiedCell = firstRow.locator(".admin-tracker-notified-cell");
  await expect(notifiedCell.locator(".is-empty")).not.toBeVisible({ timeout: 5000 });
  await expect(notifyBtn).toHaveAttribute("aria-label", "Reenviar notificación");
});

// ── Responsivo ────────────────────────────────────────────────────────────────

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test(`Rastreador notificar — responsivo ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${BASE_URL}/rastreador`);
    await page.waitForLoadState("networkidle");

    const btn = page.locator(NOTIFY_BTN).first();
    await expect(btn).toBeVisible({ timeout: 10000 });

    await btn.click();
    const modal = page.locator(".confirm-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Sin overflow horizontal con modal abierto
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `overflow horizontal en ${viewport.name} con modal abierto`).toBe(false);

    // Cancelar para no modificar estado más de una vez por run
    await modal.locator(".btn-modal-secondary").click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });
}
