import { expect, test } from "@playwright/test";
import path from "node:path";

test("marketing replay pauses, scrubs to overlap, toggles markers, and restarts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.screenshot({ path: path.resolve("docs/screenshots/landing.png"), fullPage: true });
  const scrubber = page.getByRole("slider", { name: "Scrub the session" });
  await scrubber.fill("12");
  await expect(page.getByText("Overlap · same lines", { exact: true })).toBeVisible();
  await expect(page.getByText("<<<<<<< refs/overlap/gagan/token-rotation  (Claude Code)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide conflict markers" }).click();
  await expect(page.getByRole("button", { name: "Show conflict markers" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Show conflict markers" }).click();
  await expect(page.getByRole("button", { name: "Hide conflict markers" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Playback speed" }).click();
  await expect(page.getByRole("button", { name: "Playback speed" })).toHaveText("2×");
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.getByText("All lines clear", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open your room/ }).first()).toHaveAttribute("href", "/app");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(errors).toEqual([]);
});

test("mobile marketing and workspace fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/app"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});

test("workspace explains missing configuration without pretending to connect", async ({ page }) => {
  test.skip(process.env.E2E_SUPABASE_STUB === "1", "Run without Supabase env vars to verify missing configuration.");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /Prepare your shared desk\.|Take your place\./ })).toBeVisible();
  test.skip(await page.getByRole("heading", { name: "Take your place." }).isVisible(), "A configured local backend is present; missing-config coverage runs in clean CI.");
  await expect(page.getByRole("heading", { name: "Prepare your shared desk." })).toBeVisible();
  await expect(page.getByText("NEXT_PUBLIC_SUPABASE_URL", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create room" })).toHaveCount(0);
  await expect(page.getByText("Opening your signal desk…")).toHaveCount(0);
  await page.screenshot({ path: path.resolve("docs/screenshots/workspace.png"), fullPage: true });
});
