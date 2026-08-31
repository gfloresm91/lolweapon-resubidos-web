import { expect, test } from "@playwright/test";

const FIRST_LIVE = {
  id: "playwright-live-1",
  date: "29/08/2026",
  year: "2026",
  month: "08",
  title: "Directo cargado al navegar",
  status: "En directo",
  tags: [],
  links: {},
};

const SECOND_LIVE = {
  ...FIRST_LIVE,
  id: "playwright-live-2",
  title: "Directo creado automáticamente",
};

test("carga, reutiliza e invalida el catálogo al navegar internamente", async ({ page }) => {
  let requestCount = 0;
  let lives = [FIRST_LIVE];

  await page.route("**/api/lives*", async (route) => {
    requestCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ lives, statuses: ["En directo"] }),
    });
  });

  async function openTracker() {
    const trackerLink = page.getByRole("link", { name: "Rastreador de directos" });
    if (!(await trackerLink.isVisible())) {
      await page.locator("summary", { hasText: "Archivo VOD" }).click();
    }
    await trackerLink.click();
  }

  await page.goto("/changelog", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await openTracker();

  await expect(page).toHaveURL(/\/rastreador$/);
  await expect.poll(() => requestCount).toBe(1);
  await expect(page.getByText(FIRST_LIVE.title, { exact: true })).toBeVisible();
  expect(requestCount).toBe(1);

  await page.getByRole("link", { name: "Historial de cambios" }).click();
  await openTracker();
  await expect(page.getByText(FIRST_LIVE.title, { exact: true })).toBeVisible();
  expect(requestCount).toBe(1);

  lives = [SECOND_LIVE, FIRST_LIVE];
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("kala:lives:update", {
      detail: { type: "lives:update", action: "created", liveId: "playwright-live-2" },
    }));
  });

  await expect(page.getByText(SECOND_LIVE.title, { exact: true })).toBeVisible({ timeout: 6000 });
  expect(requestCount).toBe(2);
});
