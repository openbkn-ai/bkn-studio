import { expect, test } from "@playwright/test";

const OPERATOR_ID = "e0b56d33-31e8-4646-a32d-8bac094073c5";

test("operator edit form shows saved description", async ({ page, request }) => {
  const apiBase = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:9000/api";
  const businessDomain = process.env.E2E_BUSINESS_DOMAIN ?? "bd_public";

  const detailResponse = await request.get(
    `${apiBase}/agent-operator-integration/v1/operator/info/${OPERATOR_ID}`,
    { headers: { "x-business-domain": businessDomain } },
  );
  expect(detailResponse.ok()).toBeTruthy();
  const detail = (await detailResponse.json()) as {
    metadata?: { description?: string };
  };
  const expectedDescription = detail.metadata?.description ?? "";
  expect(expectedDescription.length).toBeGreaterThan(0);

  let browserDetail: { metadata?: { description?: string }; name?: string } | null =
    null;
  page.on("response", (response) => {
    void (async () => {
      if (
        response.url().includes(`/operator/info/${OPERATOR_ID}`) &&
        response.request().method() === "GET"
      ) {
        browserDetail = (await response.json()) as {
          metadata?: { description?: string };
          name?: string;
        };
      }
    })();
  });

  const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
  await page.goto(`${baseUrl}/execution-factory/units/${OPERATOR_ID}/edit`);
  await page.waitForLoadState("networkidle");

  await expect.poll(() => browserDetail?.metadata?.description).toBe(expectedDescription);

  const nameField = page.locator("#name");
  await expect(nameField).toBeVisible({ timeout: 15000 });
  await expect(nameField).not.toHaveValue("", { timeout: 15000 });

  const openapiField = page.locator("#openapiSpec");
  await expect(openapiField).toBeVisible({ timeout: 15000 });
  await expect(openapiField).toContainText('"openapi"', { timeout: 15000 });
  await expect(openapiField).toContainText('"paths"', { timeout: 15000 });

  const descriptionField = page.locator("#description");
  await expect(descriptionField).toHaveValue(expectedDescription, { timeout: 15000 });
});
