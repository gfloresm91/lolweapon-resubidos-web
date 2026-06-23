import { expect, test } from "@playwright/test";
import fs from "node:fs";

const VIEWPORTS = [
  { name: "mobile-min",       width: 320,  height: 1080 },
  { name: "mobile-narrow",    width: 360,  height: 740  },
  { name: "mobile-base",      width: 390,  height: 844  },
  { name: "mobile-large",     width: 430,  height: 932  },
  { name: "tablet-vertical",  width: 768,  height: 1080 },
  { name: "tablet-standard",  width: 768,  height: 1024 },
  { name: "breakpoint-sidebar", width: 900, height: 900 },
  { name: "laptop",           width: 1024, height: 1080 },
  { name: "desktop-standard", width: 1280, height: 900  },
  { name: "desktop-wide",     width: 1440, height: 1080 },
];

const SCREENSHOT_DIR = "/tmp/notification-center";
const BASE_URL = "http://localhost:3000";

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

for (const viewport of VIEWPORTS) {
  test(`NotificationCenter — ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Esperar la request de notificaciones (useEffect post-hidratación) antes de navegar
    const notifResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/notifications") && r.status() === 200,
      { timeout: 20000 },
    );
    await page.goto(`${BASE_URL}/inicio`);

    // Esperar el app shell y la hidratación de React
    const trigger = page.locator(".notification-trigger");
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await notifResponsePromise;

    // Captura topbar sin panel
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${viewport.name}-01-topbar.png`,
      fullPage: false,
    });
    await trigger.click();

    const popover = page.locator(".notification-popover");
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Captura con el panel abierto
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${viewport.name}-02-panel-open.png`,
      fullPage: false,
    });

    // Verifica que el panel no desborde horizontalmente
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow, `overflow horizontal en ${viewport.name}`).toBe(false);

    // Verifica que el panel esté dentro del viewport
    const popoverBox = await popover.boundingBox();
    expect(popoverBox, "panel debe tener dimensiones").not.toBeNull();
    expect(popoverBox.x, "panel no debe salir por la izquierda").toBeGreaterThanOrEqual(0);
    expect(
      popoverBox.x + popoverBox.width,
      "panel no debe salir por la derecha",
    ).toBeLessThanOrEqual(viewport.width + 1);

    // Navega a tab Actividad
    await page.locator(".notification-tabs button", { hasText: "Actividad" }).click();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${viewport.name}-03-tab-actividad.png`,
      fullPage: false,
    });

    // Navega a tab Sistema
    await page.locator(".notification-tabs button", { hasText: "Sistema" }).click();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${viewport.name}-04-tab-sistema.png`,
      fullPage: false,
    });

    // Cierra con Escape
    await page.keyboard.press("Escape");
    await expect(popover).not.toBeVisible({ timeout: 3000 });
  });
}
