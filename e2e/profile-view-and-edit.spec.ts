import { test, expect } from "@playwright/test";

import { newAccount, registerAccount } from "./support/auth";
import { gotoProfile } from "./support/profile";

// T-UI-08 · Profile view and edit (FE-02, FE-04, INT-01; behavior.md §2).

// A same-document data: URI so the <img> loads without any network access (D-03: avatarUrl is an arbitrary string,
// not validated as a reachable URL), avoiding flakiness from a real external host in a sandboxed test run.
const AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

test.describe("T-UI-08 · profile view and edit", () => {
  test("a signed-in user sees their identity and default preferences on /profile", async ({ page }) => {
    const account = newAccount("profile-view");
    await registerAccount(page.request, account);

    await gotoProfile(page);

    await expect(page.getByText(`Name: ${account.name}`)).toBeVisible();
    await expect(page.getByText(`Email: ${account.email}`)).toBeVisible();
    await expect(page.getByText("NPR (₹)")).toBeVisible();
    await expect(page.getByText("English (EN)")).toBeVisible();
    await expect(page.getByText("1st of every month")).toBeVisible();
  });

  test("editing the display name and avatar URL updates the Identity Card immediately, without a reload", async ({
    page,
  }) => {
    const account = newAccount("profile-edit");
    await registerAccount(page.request, account);
    await gotoProfile(page);
    const visitedUrls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        visitedUrls.push(frame.url());
      }
    });

    await page.getByRole("button", { name: "Edit Profile" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Profile" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Display Name").fill("Updated Name");
    await dialog.getByLabel("Avatar URL").fill(AVATAR_DATA_URI);
    await dialog.getByRole("button", { name: "Save Changes" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Name: Updated Name")).toBeVisible();
    await expect(page.getByRole("img", { name: "Updated Name's avatar" })).toHaveAttribute("src", AVATAR_DATA_URI);
    // No full navigation happened: the identity card updated purely via the query-cache write (FE-04).
    expect(visitedUrls).toHaveLength(0);
  });
});
