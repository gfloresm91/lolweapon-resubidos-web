import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-s", width: 320, height: 1080 },
  { name: "mobile-m", width: 390, height: 844 },
  { name: "mobile-l", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 844 },
  { name: "desktop", width: 1440, height: 1080 },
  { name: "desktop-wide", width: 1920, height: 1080 },
];

test.setTimeout(60000);

for (const viewport of VIEWPORTS) {
  test(`multistream — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/twitch/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stream: { id: "playwright-live", title: "Directo de prueba", viewer_count: 100 },
          profile: null,
          channelInfo: null,
          game: null,
        }),
      });
    });

    await page.goto("/inicio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "VK + Twitch" }).waitFor();
    const closeSidebar = page.getByRole("button", { name: "Cerrar menu" });
    if (await page.locator("#main-sidebar").evaluate((element) => element.classList.contains("is-open"))) {
      await closeSidebar.evaluate((element) => element.click());
      await expect(page.locator("#main-sidebar")).not.toHaveClass(/is-open/);
    }

    const persistentPlayer = page.locator(".persistent-twitch-player");
    const primaryPlayer = page.locator(".stream-layout.is-twitch .stream-twitch-inline-player");
    await expect.poll(async () => primaryPlayer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return Math.round(rect.width * rect.height);
    })).toBeGreaterThan(0);
    await expect(persistentPlayer).toHaveClass(/is-hidden/);

    const primaryBox = await primaryPlayer.boundingBox();
    expect(primaryBox).not.toBeNull();
    await expect(page.locator('.stream-vk-player iframe')).toHaveCount(0);

    if (viewport.width <= 1200) {
      await expect(page.locator(".persistent-footer")).toBeHidden();
      if (viewport.width <= 1024) {
        await expect(page.locator(".stream-layout.is-twitch .stream-chat")).toHaveCount(0);
        await page.getByRole("button", { name: "Ver con chat" }).click();
        const twitchChatTheater = page.getByRole("dialog", { name: "Twitch con chat" });
        const theaterChat = page.locator(".stream-chat-portal");
        const theaterPlayer = twitchChatTheater.locator(".stream-twitch-inline-player");
        await expect(twitchChatTheater).toBeVisible();
        await expect(page.locator("body")).toHaveClass(/is-twitch-chat-theater-open/);
        await expect(theaterChat).toBeVisible();
        const theaterChatBox = await theaterChat.boundingBox();
        const theaterPlayerBox = await theaterPlayer.boundingBox();
        expect(theaterChatBox).not.toBeNull();
        expect(theaterPlayerBox).not.toBeNull();
        if (viewport.width >= 901) {
          expect(theaterChatBox.x).toBeGreaterThan(theaterPlayerBox.x + theaterPlayerBox.width - 1);
        } else {
          expect(theaterChatBox.y).toBeGreaterThan(theaterPlayerBox.y + theaterPlayerBox.height - 1);
          expect(Math.abs(theaterChatBox.width - viewport.width)).toBeLessThanOrEqual(10);
        }
        await twitchChatTheater.getByRole("button", { name: "Información del directo" }).click();
        const theaterInfoSheet = page.getByRole("dialog", { name: "Información del directo" });
        await expect(theaterInfoSheet).toBeVisible();
        await expect.poll(() => theaterInfoSheet.evaluate((sheet) => {
          const rect = sheet.getBoundingClientRect();
          const foregroundElement = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
          return Boolean(foregroundElement && sheet.contains(foregroundElement));
        })).toBe(true);
        await theaterInfoSheet.getByRole("button", { name: "Cerrar información" }).click();
        await expect(theaterInfoSheet).toHaveCount(0);
        await page.getByRole("button", { name: "Salir del modo chat" }).click();
        await expect(twitchChatTheater).toHaveCount(0);
        await expect(theaterChat).toHaveCount(0);
        await expect(page.locator("body")).not.toHaveClass(/is-twitch-chat-theater-open/);
      }
      await page.getByRole("button", { name: "Información del directo" }).click();
      const twitchInfoSheet = page.getByRole("dialog", { name: "Información del directo" });
      await expect(twitchInfoSheet).toBeVisible();
      await expect.poll(() => twitchInfoSheet.evaluate((sheet) => {
        const rect = sheet.getBoundingClientRect();
        const foregroundElement = document.elementFromPoint(rect.left + (rect.width / 2), rect.bottom - 4);
        return Boolean(foregroundElement && sheet.contains(foregroundElement));
      })).toBe(true);
      await page.getByRole("button", { name: "Cerrar información" }).click();
      await expect(twitchInfoSheet).toHaveCount(0);
    }

    if (viewport.width > 1200) {
      const twitchLayoutBox = await page.locator(".stream-layout.is-twitch").boundingBox();
      const twitchOnlyChatBox = await page.locator(".stream-layout.is-twitch .stream-chat").boundingBox();
      expect(twitchLayoutBox).not.toBeNull();
      expect(twitchOnlyChatBox).not.toBeNull();
      expect(Math.abs(
        (twitchOnlyChatBox.y + twitchOnlyChatBox.height)
        - (twitchLayoutBox.y + twitchLayoutBox.height)
      )).toBeLessThanOrEqual(2);

      await page.getByRole("button", { name: "Abrir modo teatro" }).click();
      const desktopTwitchTheater = page.getByRole("dialog", { name: "Twitch con chat" });
      const desktopTheaterChat = page.locator(".stream-chat-portal");
      await expect(desktopTwitchTheater).toBeVisible();
      await expect(desktopTheaterChat).toBeVisible();
      const desktopTheaterPlayerBox = await desktopTwitchTheater.locator(".stream-twitch-inline-player").boundingBox();
      const desktopTheaterChatBox = await desktopTheaterChat.boundingBox();
      expect(desktopTheaterPlayerBox).not.toBeNull();
      expect(desktopTheaterChatBox).not.toBeNull();
      expect(desktopTheaterChatBox.x).toBeGreaterThan(desktopTheaterPlayerBox.x + desktopTheaterPlayerBox.width - 1);
      expect(desktopTheaterChatBox.y + desktopTheaterChatBox.height).toBeLessThanOrEqual(viewport.height);
      await desktopTwitchTheater.getByRole("button", { name: "Salir del modo chat" }).click();
      await expect(desktopTwitchTheater).toHaveCount(0);
      await expect(desktopTheaterChat).toHaveCount(0);
    }

    await page.evaluate(() => {
      window.__dualModePlayRequests = 0;
      window.addEventListener("kala:twitch-play-request", () => {
        window.__dualModePlayRequests += 1;
      });
    });
    await page.getByRole("button", { name: "VK + Twitch" }).click();
    const vkPlayer = page.locator('.stream-vk-player iframe[title="Directo completo en VK Video"]');
    const companionPlayer = page.locator(".stream-twitch-companion");
    const twitchChat = page.locator(".stream-chat");
    const twitchHeading = page.locator(".stream-companion-heading");
    const theater = page.getByRole("dialog", { name: "Modo dual VK y Twitch" });
    await expect(theater).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/is-dual-theater-open/);
    const theaterBox = await theater.boundingBox();
    expect(theaterBox).not.toBeNull();
    expect(Math.abs(theaterBox.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(theaterBox.height - viewport.height)).toBeLessThanOrEqual(1);
    await expect(vkPlayer).toBeVisible();
    await expect(page.locator(".stream-platform-heading")).toHaveText("VK Video");
    await expect(page.locator(".stream-dual-notice")).toHaveCount(0);
    await expect(page.getByText("Versión completa", { exact: true })).toHaveCount(0);
    await expect(vkPlayer).toHaveAttribute("allowfullscreen", "");
    await expect(vkPlayer).toHaveAttribute("allow", /fullscreen/);
    await expect.poll(() => page.evaluate(() => window.__dualModePlayRequests)).toBeGreaterThanOrEqual(1);
    await expect(companionPlayer).toBeVisible();
    await expect(persistentPlayer).toHaveClass(/is-hidden/);
    await expect(page.locator("#persistent-twitch-player-embed")).toHaveCount(1);
    const streamDetails = page.locator(".stream-details");
    if (viewport.width <= 1200) {
      await expect(streamDetails).toHaveCount(0);
      await page.getByRole("button", { name: "Información del directo" }).click();
      const infoSheet = page.getByRole("dialog", { name: "Información del directo" });
      await expect(infoSheet).toBeVisible();
      await expect(infoSheet.getByText("Directo de prueba", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(infoSheet).toHaveCount(0);
      await expect(theater).toBeVisible();
    } else {
      await expect(streamDetails).toBeVisible();
      await expect(streamDetails.getByText("Directo de prueba", { exact: true })).toBeVisible();
    }
    const headingGap = await twitchHeading.evaluate((element) => {
      const [label, state] = element.children;
      if (!label || !state) return Number.POSITIVE_INFINITY;
      return state.getBoundingClientRect().left - label.getBoundingClientRect().right;
    });
    expect(headingGap).toBeLessThanOrEqual(12);

    const vkBox = await vkPlayer.boundingBox();
    const companionBox = await companionPlayer.boundingBox();
    const chatBox = await twitchChat.boundingBox();
    expect(vkBox).not.toBeNull();
    expect(companionBox).not.toBeNull();
    expect(companionBox.height).toBeGreaterThanOrEqual(299);

    if (viewport.width <= 1200) {
      expect(chatBox).toBeNull();
      expect(companionBox.y).toBeGreaterThan(vkBox.y + vkBox.height - 1);
      const chatToggle = page.getByRole("button", { name: "Mostrar chat" });
      await expect(chatToggle).toBeVisible();
      await chatToggle.click();
      const expandedVkBox = await vkPlayer.boundingBox();
      const expandedChatBox = await twitchChat.boundingBox();
      const displacedCompanionBox = await companionPlayer.boundingBox();
      expect(expandedVkBox).not.toBeNull();
      expect(expandedChatBox).not.toBeNull();
      expect(displacedCompanionBox).not.toBeNull();
      expect(expandedChatBox.y).toBeGreaterThan(expandedVkBox.y + expandedVkBox.height - 1);
      expect(expandedChatBox.y + expandedChatBox.height).toBeLessThanOrEqual(theaterBox.y + theaterBox.height);
      expect(displacedCompanionBox.y).toBeLessThan(expandedChatBox.y + expandedChatBox.height);
      const expandedChatIframeBox = await twitchChat.locator("iframe").boundingBox();
      expect(expandedChatIframeBox).not.toBeNull();
      expect(Math.abs(expandedChatIframeBox.height - expandedChatBox.height)).toBeLessThanOrEqual(2);
      await page.getByRole("button", { name: "Ocultar chat" }).click();
      await expect(twitchChat).toBeHidden();
    } else {
      expect(chatBox).not.toBeNull();
      expect(companionBox.x).toBeGreaterThan(vkBox.x + vkBox.width - 1);
      expect(chatBox.y).toBeGreaterThan(companionBox.y + companionBox.height - 1);
      const layoutBox = await page.locator(".stream-layout.is-dual").boundingBox();
      expect(layoutBox).not.toBeNull();
      expect(Math.abs((chatBox.y + chatBox.height) - (layoutBox.y + layoutBox.height))).toBeLessThanOrEqual(2);
    }

    const theaterScrollY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 240));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(theaterScrollY);

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    ));
    expect(hasHorizontalOverflow).toBe(false);

    if (viewport.name === "tablet") {
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: "Salir del modo dual" }).click();
    }
    await expect(theater).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/is-dual-theater-open/);
    await expect(vkPlayer).toHaveCount(0);
    await expect(primaryPlayer).toBeVisible();
    await expect(page.getByRole("button", { name: "Twitch", exact: true })).toHaveAttribute("aria-pressed", "true");

    if (viewport.width <= 1200) {
      await expect(page.getByRole("button", { name: /(?:Mostrar|Ocultar) chat/ })).toHaveCount(0);
      if (viewport.width <= 1024) {
        await expect(twitchChat).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Ver con chat" })).toBeVisible();
      } else {
        await expect(twitchChat).toBeVisible();
      }
    }

    if (viewport.width >= 768) {
      await page.evaluate(() => {
        window.history.pushState(null, "", "/rastreador");
        window.dispatchEvent(new CustomEvent("kala:navigation", { detail: { path: "/rastreador" } }));
      });
      await expect(persistentPlayer).toHaveClass(/is-mini/);
      const miniBox = await persistentPlayer.boundingBox();
      expect(miniBox).not.toBeNull();
      expect(miniBox.width).toBeGreaterThanOrEqual(533);
      expect(miniBox.height).toBeGreaterThanOrEqual(299);
    }
  });
}
