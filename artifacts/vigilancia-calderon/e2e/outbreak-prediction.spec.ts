import { expect, test, type Page } from "@playwright/test";

const insufficientPrediction = {
  generatedAt: "2026-08-30T00:00:00.000Z",
  status: "insufficient_data",
  signal: "insufficient",
  score: 0,
  summary: "No hay suficientes registros clínicos guardados para generar una señal de brote.",
  coverage: {
    savedRecords: 0,
    occupiedBeds: 0,
    positiveCultures: 0,
    positiveSwabs: 0,
    datedPositiveResults: 0,
    periodStart: null,
    periodEnd: null,
  },
  areas: [],
  factors: [],
  missingData: ["Registros operativos de camas ocupadas"],
  recommendations: ["Ingresa los registros del turno."],
  limitations: ["No hay una serie histórica continua."],
  reviewRequired: true,
};

async function mockPrediction(page: Page, body: unknown, status = 200) {
  await page.route("**/api/vigilancia/outbreak-prediction", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("navega al módulo y explica cuando los datos son insuficientes", async ({ page }) => {
  await mockPrediction(page, insufficientPrediction);
  await page.goto("/");
  await page.getByTestId("link-nav-predicción-de-brotes").click();
  await expect(page).toHaveURL(/\/prediccion-brotes$/);
  await expect(page.getByRole("heading", { name: "Predicción y Análisis de Brotes" })).toBeVisible();
  await expect(page.getByText("No sustituye el criterio clínico")).toBeVisible();
  await page.getByTestId("analysis-button").click();
  await expect(page.getByTestId("insufficient-state")).toBeVisible();
  await expect(page.getByTestId("insufficient-state")).toContainText("No hay suficientes registros");
});

test("muestra señal, cobertura, áreas y recomendaciones del análisis", async ({ page }) => {
  await mockPrediction(page, {
    ...insufficientPrediction,
    status: "ready",
    signal: "high",
    score: 78,
    summary: "Dos resultados positivos agrupados en la sala 201 requieren revisión epidemiológica prioritaria.",
    coverage: {
      savedRecords: 4,
      occupiedBeds: 4,
      positiveCultures: 1,
      positiveSwabs: 1,
      datedPositiveResults: 2,
      periodStart: "2026-08-28",
      periodEnd: "2026-08-29",
    },
    areas: [{
      room: "201",
      signal: "high",
      positiveResults: 2,
      occupiedBeds: 3,
      detail: "Agrupación de dos resultados positivos en la misma sala.",
    }],
    factors: [{
      kind: "elevates",
      title: "Agrupación por sala",
      detail: "Se observan dos resultados positivos en la sala 201.",
    }],
    missingData: ["Serie histórica de resultados negativos"],
    recommendations: ["Revisar los resultados y las medidas de aislamiento de la sala 201."],
  });

  await page.goto("/prediccion-brotes");
  await page.getByTestId("analysis-button").click();
  await expect(page.getByTestId("result-container")).toBeVisible();
  await expect(page.getByTestId("signal")).toHaveText("Señal Alta");
  await expect(page.getByTestId("coverage")).toContainText("4");
  await expect(page.getByText("Sala 201", { exact: true })).toBeVisible();
  await expect(page.getByText("Revisar los resultados y las medidas de aislamiento de la sala 201.")).toBeVisible();

  await page.setViewportSize({ width: 402, height: 874 });
  const widths = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
});

test("permite reintentar cuando Gemini no está disponible", async ({ page }) => {
  await mockPrediction(page, { error: "No se pudo generar la predicción." }, 502);
  await page.goto("/prediccion-brotes");
  await page.getByTestId("analysis-button").click();
  await expect(page.getByTestId("error")).toBeVisible();
  await expect(page.getByText("Error al procesar el análisis")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("rechaza llamadas directas que no provienen de la plataforma", async ({ request }) => {
  const response = await request.post("/api/vigilancia/outbreak-prediction");
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({
    error: "La solicitud debe originarse desde la plataforma de vigilancia.",
  });
});