import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { MockSupabase } from "./mock-supabase";

test.describe("explicit mocked Supabase UI contract (not live service verification)", () => {
  test.skip(process.env.E2E_SUPABASE_STUB !== "1", "Requires a server built with the documented fake Supabase URL/key. No real account is contacted.");

  async function signIn(page: Page, email: string) {
    await page.goto("/app");
    await page.getByLabel("Your email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText(/Check your email/)).toBeVisible();
    await page.getByLabel("Email code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByText(`Signed in as ${email}`, { exact: true })).toBeVisible();
  }

  async function claim(page: Page, start: number, end: number) {
    await page.getByLabel("Repository-relative file path").fill("src/login.ts");
    await page.getByLabel("First line").fill(String(start));
    await page.getByLabel("Last line").fill(String(end));
    await page.getByRole("button", { name: "Claim lines & check overlap" }).click();
  }

  test("two isolated users create/join a room, see overlapping claims via polling, release, reconnect, and log out", async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    testInfo.annotations.push({ type: "coverage", description: "Auth and REST are mocked. WebSocket is deliberately unavailable. Tests browser session isolation and polling fallback only; SQL/RLS, email delivery, live Realtime and OpenAI require separate integration checks." });
    const backend = new MockSupabase();
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    await backend.connect(aliceContext); await backend.connect(bobContext);
    const alice = await aliceContext.newPage(); const bob = await bobContext.newPage();
    try {
      await signIn(alice, "alice@example.test");
      await alice.getByLabel("Name teammates see").fill("Alice");
      await alice.getByLabel("New room name").fill("auth-sprint");
      await alice.getByRole("button", { name: "Create room", exact: true }).click();
      await expect(alice.getByText("Room #auth-sprint", { exact: true })).toBeVisible();
      await expect(alice.getByText("e2e-private-invite", { exact: true })).toBeVisible();
      await claim(alice, 40, 80);
      await expect(alice.getByText("src/login.ts:40–80", { exact: true })).toBeVisible();

      await signIn(bob, "bob@example.test");
      await expect(bob.getByRole("button", { name: "# auth-sprint", exact: true })).toHaveCount(0);
      await bob.getByLabel("Name teammates see").fill("Bob");
      await bob.getByText("Have an invite?", { exact: true }).click();
      await bob.getByLabel("Private invite code").fill("e2e-private-invite");
      await bob.getByRole("button", { name: "Join room", exact: true }).click();
      await expect(bob.getByText("src/login.ts:40–80", { exact: true })).toBeVisible();
      await claim(bob, 60, 90);
      await expect(bob.getByRole("alert").filter({ hasText: "Overlap detected" })).toBeVisible();
      await expect(alice.getByRole("alert").filter({ hasText: "Overlap detected" })).toBeVisible({ timeout: 20000 });
      await expect(alice.getByText("src/login.ts:60–90", { exact: true })).toBeVisible();
      await alice.screenshot({ path: path.resolve("docs/screenshots/workspace-example.png"), fullPage: true });
      await expect(alice.getByRole("button", { name: "Release", exact: true })).toHaveCount(1);
      await expect(bob.getByRole("button", { name: "Release", exact: true })).toHaveCount(1);
      await bob.getByRole("button", { name: "Release", exact: true }).click();
      await expect(bob.getByRole("alert").filter({ hasText: "Overlap detected" })).toHaveCount(0);
      await expect(alice.getByText("src/login.ts:60–90", { exact: true })).toHaveCount(0, { timeout: 20000 });
      await aliceContext.setOffline(true);
      await expect(alice.getByRole("alert").filter({ hasText: "You are offline" })).toBeVisible();
      await aliceContext.setOffline(false);
      await expect(alice.getByRole("alert").filter({ hasText: "You are offline" })).toHaveCount(0);
      await alice.reload();
      await expect(alice.getByText("Signed in as alice@example.test", { exact: true })).toBeVisible();
      await expect(alice.getByText("src/login.ts:40–80", { exact: true })).toBeVisible();
      await alice.getByText("Manage room members", { exact: true }).click();
      alice.once("dialog", (dialog) => dialog.accept());
      await alice.getByRole("button", { name: "Remove Bob", exact: true }).click();
      await expect(alice.getByText(/Member removed. The previous invite is invalid/)).toBeVisible();
      await expect(alice.getByRole("button", { name: "Remove Bob", exact: true })).toHaveCount(0);
      await bob.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(bob.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
      await expect(alice.getByText("Signed in as alice@example.test", { exact: true })).toBeVisible();
      expect(backend.calls).toContain("/rest/v1/rpc/claim_lines");
      expect(backend.calls).toContain("/rest/v1/rpc/release_claim");
      await testInfo.attach("mock-api-usage", { body: JSON.stringify({ mockedRequests: backend.calls.length, calls: backend.calls, liveProviderRequests: 0, cost: "Billing data unavailable; no real Supabase/OpenAI requests made." }, null, 2), contentType: "application/json" });
    } finally { await aliceContext.close(); await bobContext.close(); }
  });
});
