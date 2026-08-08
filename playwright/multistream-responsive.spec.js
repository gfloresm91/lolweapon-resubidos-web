import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1080 },
];

test.setTimeout(60000);

async function expectAligned(player, anchor) {
  await expect.poll(async () => {
    const [playerBox, anchorBox] = await Promise.all([player.boundingBox(), anchor.boundingBox()]);
    if (!playerBox || !anchorBox) return false;
    return ["x", "y", "width", "height"].every((key) => Math.abs(playerBox[key] - anchorBox[key]) <= 2);
  }).toBe(true);
}

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
    if (await closeSidebar.isVisible()) {
      await closeSidebar.click();
      await expect(page.locator("#main-sidebar")).not.toHaveClass(/is-open/);
    }

    const persistentPlayer = page.locator(".persistent-twitch-player");
    const primaryAnchor = page.locator(".stream-layout.is-twitch [data-twitch-player-anchor]");
    await expect.poll(async () => primaryAnchor.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return Math.round(rect.width * rect.height);
    })).toBeGreaterThan(0);
    await expect(persistentPlayer).toHaveClass(/is-home/);

    const primaryBox = await primaryAnchor.boundingBox();
    const twitchBox = await persistentPlayer.boundingBox();
    expect(primaryBox).not.toBeNull();
    expect(twitchBox).not.toBeNull();
    await expectAligned(persistentPlayer, primaryAnchor);
    await expect(page.locator('.stream-vk-player iframe')).toHaveCount(0);

    if (viewport.width > 1200) {
      const twitchLayoutBox = await page.locator(".stream-layout.is-twitch").boundingBox();
      const twitchOnlyChatBox = await page.locator(".stream-layout.is-twitch .stream-chat").boundingBox();
      expect(twitchLayoutBox).not.toBeNull();
      expect(twitchOnlyChatBox).not.toBeNull();
      expect(Math.abs(
        (twitchOnlyChatBox.y + twitchOnlyChatBox.height)
        - (twitchLayoutBox.y + twitchLayoutBox.height)
      )).toBeLessThanOrEqual(2);
    }

    await page.evaluate(() => {
      window.__dualModePlayRequests = 0;
      window.addEventListener("kala:twitch-play-request", () => {
        window.__dualModePlayRequests += 1;
      });
    });
    await page.getByRole("button", { name: "VK + Twitch" }).click();
    const vkPlayer = page.locator('.stream-vk-player iframe[title="Directo completo en VK Video"]');
    const companionAnchor = page.locator(".stream-twitch-companion[data-twitch-player-anchor]");
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
    await expect.poll(() => page.evaluate(() => window.__dualModePlayRequests)).toBe(1);
    await expect(companionAnchor).toBeVisible();
    await expect(persistentPlayer).toHaveClass(/is-home/);
    await expect(page.locator("#persistent-twitch-player-embed")).toHaveCount(1);
    const streamDetails = page.locator(".stream-details");
    await expect(streamDetails).toBeVisible();
    await expect(streamDetails.getByText("Directo de prueba", { exact: true })).toBeVisible();
    await expect(streamDetails.getByText("Twitch", { exact: true })).toBeVisible();
    const detailsBox = await streamDetails.boundingBox();
    expect(detailsBox).not.toBeNull();
    const headingGap = await twitchHeading.evaluate((element) => {
      const [label, state] = element.children;
      if (!label || !state) return Number.POSITIVE_INFINITY;
      return state.getBoundingClientRect().left - label.getBoundingClientRect().right;
    });
    expect(headingGap).toBeLessThanOrEqual(12);

    const vkBox = await vkPlayer.boundingBox();
    const companionBox = await companionAnchor.boundingBox();
    const dualTwitchBox = await persistentPlayer.boundingBox();
    const chatBox = await twitchChat.boundingBox();
    expect(vkBox).not.toBeNull();
    expect(companionBox).not.toBeNull();
    expect(dualTwitchBox).not.toBeNull();
    expect(chatBox).not.toBeNull();
    expect(detailsBox.y).toBeGreaterThanOrEqual(vkBox.y + vkBox.height - 1);
    expect(companionBox.height).toBeGreaterThanOrEqual(299);
    await expectAligned(persistentPlayer, companionAnchor);

    if (viewport.width <= 1200) {
      expect(companionBox.y).toBeGreaterThan(vkBox.y + vkBox.height - 1);
      expect(chatBox.y).toBeGreaterThan(companionBox.y + companionBox.height - 1);
    } else {
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
    await expectAligned(persistentPlayer, companionAnchor);

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    ));
    expect(hasHorizontalOverflow).toBe(false);

    if (viewport.width <= 1200) {
      const chatToggle = page.getByRole("button", { name: "Chat de Twitch" });
      await expect(chatToggle).toBeHidden();
    }

    if (viewport.name === "tablet") {
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: "Salir del modo dual" }).click();
    }
    await expect(theater).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/is-dual-theater-open/);
    await expect(vkPlayer).toHaveCount(0);
    await expect(primaryAnchor).toBeVisible();
    await expect(page.getByRole("button", { name: "Twitch", exact: true })).toHaveAttribute("aria-pressed", "true");

    if (viewport.width <= 1200) {
      const chatToggle = page.getByRole("button", { name: "Chat de Twitch" });
      await expect(chatToggle).toBeVisible();
      await chatToggle.click();
      await expect(twitchChat).toHaveClass(/is-collapsed/);
      await expect(twitchChat.locator("iframe")).toHaveCount(1);
      await chatToggle.click();
      await expect(twitchChat).not.toHaveClass(/is-collapsed/);
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
