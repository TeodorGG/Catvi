const { test, expect } = require("@playwright/test");

test("desktop: real test, research consent, local history, and no fake public data", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|<title>/i.test(message.text()))
      errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(
    page.getByText("Conexiune cu serverul disponibilă"),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/review/home-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Raion / municipiu").selectOption("Chișinău");
  await page.getByLabel("Furnizor", { exact: false }).selectOption("StarNet");
  await page.getByLabel("Tip de conexiune").selectOption("ethernet");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Începe testul" }).click();
  await expect(page.getByText("Măsurare încheiată")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole("status")).toContainText(
    "adăugată la datele proiectului",
    { timeout: 10000 },
  );
  const rows = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("catvi-history-v2")),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].down).toBeGreaterThan(0);
  expect(rows[0].up).toBeGreaterThan(0);
  expect(rows[0].token).toBeUndefined();
  await page.getByRole("link", { name: "Istoricul meu" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("link", { name: "Date regionale" }).click();
  await expect(
    page.getByText("Date insuficiente", { exact: true }).last(),
  ).toBeVisible();
  expect(await (await request.get("/api/regions")).json()).toEqual([]);
  await page.getByRole("link", { name: "Administrare" }).click();
  await expect(
    page.getByRole("heading", { name: "Acces la datele proiectului." }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("admin@example.md");
  await page
    .getByLabel("Parolă", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Intră în panou" }).click();
  await expect(
    page.getByRole("heading", { name: "Datele din spatele conexiunilor." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exclude", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/review/admin-desktop.png",
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("catvi-measurements.csv");
  await page.getByRole("button", { name: "Exclude", exact: true }).click();
  await page
    .getByLabel("Motivul excluderii")
    .fill("Test local din verificarea automată");
  await page.getByRole("button", { name: "Exclude și înregistrează" }).click();
  await expect(page.locator("tbody .badge.excluded")).toHaveText("Exclus");
  await page.getByRole("button", { name: "Ieși din cont" }).click();
  await expect(
    page.getByRole("heading", { name: "Acces la datele proiectului." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile: no overflow, cancellation, optional consent, working navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(
    page.getByText("Conexiune cu serverul disponibilă"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/review/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Începe testul" }).click();
  await page.getByRole("button", { name: "Oprește" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Test oprit",
  );
  await page.getByRole("button", { name: "Începe testul" }).click();
  await expect(page.getByText("Măsurare încheiată")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole("status")).toContainText("doar în acest browser");
  for (const path of [
    "/harta",
    "/istoric",
    "/despre",
    "/confidentialitate",
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
