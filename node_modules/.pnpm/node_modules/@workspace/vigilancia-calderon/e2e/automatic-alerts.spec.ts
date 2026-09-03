import { expect, test, type Page } from "@playwright/test";

async function clearBedRecords(page: Page) {
  await Promise.all([
    page.request.delete("/api/vigilancia/records/201-a"),
    page.request.delete("/api/vigilancia/records/201-b"),
  ]);
  await page.goto("/registro");
  await page.evaluate(() => {
    localStorage.removeItem("vigilancia-registros-por-cama");
    localStorage.removeItem("vigilancia-registros-por-cama-v2");
    localStorage.removeItem("vigilancia-capturas");
    localStorage.removeItem("vigilancia-capturas-v2");
    localStorage.removeItem("vigilancia-umbrales-alerta");
  });
  await page.reload();
}

test.afterEach(async ({ request }) => {
  await Promise.all([
    request.delete("/api/vigilancia/records/201-a"),
    request.delete("/api/vigilancia/records/201-b"),
  ]);
});

async function openBed(page: Page, bedId: string, patientCode: string) {
  await page.getByTestId(`card-bed-${bedId}`).click();
  await page.getByTestId("select-bed-occupancy").selectOption("occupied");
  await page.getByTestId("input-bed-patient-code").fill(patientCode);
}

test("parte vacío y genera alertas solo con el registro ingresado", async ({ page }) => {
  await clearBedRecords(page);
  await expect(page.getByText("53 camas disponibles")).toBeVisible();
  await page.goto("/alertas");
  await expect(page.locator('[data-testid^="row-alert-"]')).toHaveCount(0);
  await page.goto("/registro");
  await openBed(page, "201-a", "AUTO-201A");
  await page.getByTestId("input-bed-stay-days").fill("3");
  await page.getByTestId("input-bed-urinary-days").fill("6");
  await page.getByTestId("select-bed-culture-type").selectOption("urine");
  await page.getByTestId("select-bed-culture-status").selectOption("positive");
  await page.getByTestId("input-bed-culture-organism").fill("E. coli");
  await page.getByTestId("input-bed-culture-positive-date").fill("2026-08-29");
  await page.getByTestId("button-save-bed-record").click();

  await expect(page.getByTestId("card-bed-201-a")).toContainText("3 señales");
  await expect(page.getByText("Alertas automáticas").locator("..")).toContainText("3");

  await page.reload();
  await expect(page.getByTestId("card-bed-201-a")).toContainText("3 señales");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("card-bed-201-a")).toContainText("AUTO-201A");
  await expect(page.getByTestId("card-bed-201-a")).toContainText("3 señales");

  await page.goto("/alertas");
  for (const id of [
    "auto-201-a-culture-positive",
    "auto-201-a-urinary-threshold",
    "auto-201-a-device-culture-combination",
  ]) {
    await expect(page.getByTestId(`row-alert-${id}`)).toHaveCount(1);
    await expect(page.getByTestId(`row-alert-${id}`)).toContainText("Automática");
  }
  await expect(page.getByTestId("row-alert-auto-201-a-culture-positive")).toContainText("E. coli");
  await expect(page.getByTestId("alert-result-date-auto-201-a-culture-positive")).toContainText("Resultado:");
  await expect(page.getByTestId("alert-result-date-auto-201-a-culture-positive")).toContainText("29");
  await expect(page.getByTestId("alert-updated-date-auto-201-a-culture-positive")).toContainText("Ficha actualizada:");
  await page.getByTestId("button-alert-status-all").click();
  const renderedIds = await page.locator('[data-testid^="row-alert-"]').evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")));
  expect(renderedIds).toHaveLength(3);
  expect(new Set(renderedIds).size).toBe(renderedIds.length);

  await page.goto("/");
  await expect(page.getByTestId("card-metric-alertas")).toContainText("3");
  await expect(page.getByTestId("card-metric-alertas")).toContainText("0 institucionales · 3 automáticas");
  await expect(page.getByTestId("row-alert-auto-201-a-culture-positive")).toBeVisible();

  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/alertas");
  const widths = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));

  const clearDatesResponse = page.waitForResponse((response) =>
    response.url().includes("/api/vigilancia/records/201-b")
      && response.request().method() === "PUT"
      && response.status() === 200,
  );
  const response = await request.post("/api/vigilancia/records/batch", {
    data: {
      rows: [
        {
          bedId: "201-a",
          ...baseline,
          patientCode: "NO-DEBE-GUARDARSE",
        },
        {
          bedId: "201-b",
          ...baseline,
          patientCode: "INVALIDO-201B",
          cultureType: "urine",
          cultureStatus: "positive",
          cultureOrganism: "",
          culturePositiveDate: "2026-08-28",
        },
      ],
    },
  });
  const records = await request.get("/api/vigilancia/records");
  const saved = records.find((record) => record.bedId === "201-b");
  expect(saved?.culturePositiveDate).toBeNull();
  expect(saved?.rectalSwabPositiveDate).toBeNull();
});

test("rechaza resultados positivos sin sus fechas en el servidor", async ({ request }) => {
  const cultureResponse = await request.put("/api/vigilancia/records/201-a", {
    data: {
      occupied: true,
      patientCode: "VALIDACION",
      diagnosis: "",
      stayDays: 2,
      urinaryCatheterDays: null,
      nasogastricTubeDays: null,
      centralLineDays: null,
      cultureType: "urine",
      cultureStatus: "positive",
      cultureOrganism: "E. coli",
      culturePositiveDate: null,
      rectalSwabStatus: "pending",
      rectalSwabOrganism: "",
      rectalSwabPositiveDate: null,
      isolation: "none",
    },
  });
  expect(cultureResponse.status()).toBe(400);

  const rectalResponse = await request.put("/api/vigilancia/records/201-a", {
    data: {
      occupied: true,
      patientCode: "VALIDACION",
      diagnosis: "",
      stayDays: 2,
      urinaryCatheterDays: null,
      nasogastricTubeDays: null,
      centralLineDays: null,
      cultureType: "none",
      cultureStatus: "pending",
      cultureOrganism: "",
      culturePositiveDate: null,
      rectalSwabStatus: "positive",
      rectalSwabOrganism: "K. pneumoniae",
      rectalSwabPositiveDate: null,
      isolation: "none",
    },
  });
  expect(rectalResponse.status()).toBe(400);
});

test("rechaza el censo completo antes de escribir si una fila es inválida", async ({ request }) => {
  const baseline = {
    occupied: true,
    patientCode: "ANTES-DEL-CENSO",
    diagnosis: "Registro anterior",
    stayDays: 1,
    urinaryCatheterDays: null,
    nasogastricTubeDays: null,
    centralLineDays: null,
    cultureType: "none",
    cultureStatus: "pending",
    cultureOrganism: "",
    culturePositiveDate: null,
    rectalSwabStatus: "pending",
    rectalSwabOrganism: "",
    rectalSwabPositiveDate: null,
    isolation: "none",
  };
  expect((await request.put("/api/vigilancia/records/201-a", { data: baseline })).status()).toBe(200);

  const response = await request.post("/api/vigilancia/records/batch", {
    data: {
      rows: [
        {
          bedId: "201-a",
          ...baseline,
          patientCode: "NO-DEBE-GUARDARSE",
        },
        {
          bedId: "201-b",
          ...baseline,
          patientCode: "INVALIDO-201B",
          cultureType: "urine",
          cultureStatus: "positive",
          cultureOrganism: "",
          culturePositiveDate: "2026-08-28",
        },
      ],
    },
  });
  expect(response.status()).toBe(400);

  const records = await request.get("/api/vigilancia/records");
  expect(records.status()).toBe(200);
  const stored = await records.json() as Array<{ bedId: string; patientCode: string }>;
  expect(stored.find((record) => record.bedId === "201-a")?.patientCode).toBe("ORIGINAL-201A");
  expect(stored.some((record) => record.bedId === "201-b")).toBe(false);
});

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const minimalPdf = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
);

const mockCensusRow = {
  bedId: "201-a",
  occupied: true,
  patientCode: "FOTO-001",
  diagnosis: "Neumonía",
  stayDays: 4,
  urinaryCatheterDays: 6,
  nasogastricTubeDays: 0,
  centralLineDays: 3,
  cultureType: "urine",
  cultureStatus: "positive",
  cultureOrganism: "E. coli",
  culturePositiveDate: "2026-08-28",
  isolation: "contact",
  rectalSwabStatus: "negative",
  rectalSwabOrganism: null,
  rectalSwabPositiveDate: null,
  confidence: "medium",
  warnings: ["Confirma el código interno."],
};

async function mockCensusTranscription(
  page: Page,
  onRequest?: (body: unknown) => void,
  rows = [mockCensusRow],
) {
  await page.route("**/api/vigilancia/transcription", async (route) => {
    onRequest?.(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows,
        warnings: ["Revisión humana obligatoria."],
        reviewedRequired: true,
      }),
    });
  });
}

test("selecciona, previsualiza y envía un censo en PDF para revisión", async ({ page }) => {
  let requestBody: { imageBase64?: string; mimeType?: string } | undefined;
  await mockCensusTranscription(page, (body) => {
    requestBody = body as typeof requestBody;
  });
  await page.goto("/transcripcion");
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-escaneado.pdf",
    mimeType: "application/pdf",
    buffer: minimalPdf,
  });

  await expect(page.getByText("censo-escaneado.pdf")).toBeVisible();
  await expect(page.getByTestId("preview-census-pdf")).toBeVisible();
  await page.getByTestId("button-transcribe-census").click();

  await expect(page.getByTestId("transcription-row-0")).toBeVisible();
  expect(requestBody?.mimeType).toBe("application/pdf");
  expect(Buffer.from(requestBody?.imageBase64 ?? "", "base64").subarray(0, 5).toString("ascii")).toBe("%PDF-");
  await expect(page.getByTestId("button-review-transcription")).toBeVisible();
});

test("rechaza un PDF demasiado grande antes de enviarlo", async ({ page }) => {
  await page.goto("/transcripcion");
  const acceptedPdf = Buffer.alloc(7 * 1024 * 1024);
  acceptedPdf.write("%PDF-1.4");
  acceptedPdf.write("%%EOF", acceptedPdf.length - 5);
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-aceptado-7mb.pdf",
    mimeType: "application/pdf",
    buffer: acceptedPdf,
  });
  await expect(page.getByTestId("preview-census-pdf")).toBeVisible();
  await expect(page.getByText("censo-aceptado-7mb.pdf")).toBeVisible();

  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-demasiado-grande.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
  });

  await expect(page.getByTestId("transcription-error")).toContainText("máximo 20 MB");
  await expect(page.getByText("Sin archivo seleccionado")).toBeVisible();
  await expect(page.getByTestId("button-transcribe-census")).toBeDisabled();
});

test("permite revisar y cancelar una transcripción sin guardar cambios", async ({ page, request }) => {
  await clearBedRecords(page);
  await mockCensusTranscription(page);
  await page.goto("/transcripcion");
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-prueba.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByTestId("button-transcribe-census").click();
  await expect(page.getByTestId("transcription-row-0")).toBeVisible();
  await expect(page.getByText("Confirma el código interno.")).toBeVisible();
  await page.getByTestId("input-transcription-code-0").fill("EDITADO-001");
  await page.getByTestId("button-cancel-transcription").click();
  await expect(page.getByTestId("transcription-row-0")).toHaveCount(0);
  const records = await request.get("/api/vigilancia/records");
  expect(await records.json()).toEqual([]);
});

test("permite guardar una transcripción aunque falten campos clínicos", async ({ page }) => {
  await clearBedRecords(page);
  await mockCensusTranscription(page, undefined, [{
    ...mockCensusRow,
    patientCode: null,
    diagnosis: "",
    stayDays: null,
    urinaryCatheterDays: null,
    nasogastricTubeDays: null,
    centralLineDays: null,
    cultureType: null,
    cultureStatus: null,
    cultureOrganism: null,
    culturePositiveDate: null,
    isolation: null,
    rectalSwabStatus: null,
    rectalSwabOrganism: null,
    rectalSwabPositiveDate: null,
  }]);
  await page.goto("/transcripcion");
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-con-pendientes.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByTestId("button-transcribe-census").click();

  await expect(page.getByTestId("button-review-transcription")).toBeEnabled();
  await page.getByTestId("button-review-transcription").click();
  await expect(page.getByTestId("transcription-confirmation")).toBeVisible();
  await page.getByTestId("button-confirm-transcription").click();
  await expect(page.getByTestId("transcription-success")).toContainText("1 filas");
});

test("exige doble confirmación y aplica las filas seleccionadas", async ({ page }) => {
  await clearBedRecords(page);
  await mockCensusTranscription(page);
  await page.goto("/transcripcion");
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-prueba.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByTestId("button-transcribe-census").click();
  await page.getByTestId("input-transcription-code-0").fill("REVISADO-001");
  await page.getByTestId("input-transcription-diagnosis-0").fill("Neumonía adquirida");
  await page.getByTestId("button-review-transcription").click();
  await expect(page.getByTestId("transcription-confirmation")).toBeVisible();
  await page.getByTestId("button-confirm-transcription").click();
  await expect(page.getByTestId("transcription-success")).toContainText("1 filas");

  await page.goto("/registro");
  await expect(page.getByTestId("card-bed-201-a")).toContainText("REVISADO-001");
  await expect(page.getByTestId("card-bed-201-a")).toContainText("3 señales");
  await page.getByTestId("card-bed-201-a").click();
  await expect(page.getByTestId("input-bed-diagnosis")).toHaveValue("Neumonía adquirida");
  await expect(page.getByTestId("input-bed-culture-positive-date")).toHaveValue("2026-08-28");
});

test("un fallo simulado de la operación única no deja filas aplicadas a medias", async ({ page, request }) => {
  await clearBedRecords(page);
  const baseline = {
    occupied: true,
    patientCode: "ANTES-DEL-CENSO",
    diagnosis: "Registro anterior",
    stayDays: 1,
    urinaryCatheterDays: null,
    nasogastricTubeDays: null,
    centralLineDays: null,
    cultureType: "none",
    cultureStatus: "pending",
    cultureOrganism: "",
    culturePositiveDate: null,
    rectalSwabStatus: "pending",
    rectalSwabOrganism: "",
    rectalSwabPositiveDate: null,
    isolation: "none",
  };
  expect((await request.put("/api/vigilancia/records/201-a", { data: baseline })).status()).toBe(200);

  await mockCensusTranscription(page, undefined, [
    mockCensusRow,
    {
      ...mockCensusRow,
      bedId: "201-b",
      patientCode: "FOTO-002",
      diagnosis: "",
      urinaryCatheterDays: null,
      centralLineDays: null,
      cultureType: "none",
      cultureStatus: "pending",
      cultureOrganism: null,
      culturePositiveDate: null,
      isolation: "none",
      warnings: [],
    },
  ]);

  let batchRequests = 0;
  let submittedRows = 0;
  await page.route("**/api/vigilancia/records/batch", async (route) => {
    batchRequests += 1;
    const body = route.request().postDataJSON() as { rows: unknown[] };
    submittedRows = body.rows.length;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fallo simulado." }),
    });
  });

  await page.goto("/transcripcion");
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-dos-filas.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByTestId("button-transcribe-census").click();
  await expect(page.getByTestId("transcription-row-1")).toBeVisible();
  await page.getByTestId("button-review-transcription").click();
  await page.getByTestId("button-confirm-transcription").click();

  await expect(page.getByTestId("transcription-error")).toContainText("No se modificó ninguna fila");
  expect(batchRequests).toBe(1);
  expect(submittedRows).toBe(2);

  const records = await request.get("/api/vigilancia/records");
  const stored = await records.json() as Array<{ bedId: string; patientCode: string }>;
  expect(stored.find((record) => record.bedId === "201-a")?.patientCode).toBe("ANTES-DEL-CENSO");
  expect(stored.some((record) => record.bedId === "201-b")).toBe(false);
});

test("rechaza cargas de transcripción con formato inválido", async ({ request }) => {
  const nonImage = await request.post("/api/vigilancia/transcription", {
    data: { imageBase64: Buffer.from("contenido que no es una imagen").toString("base64"), mimeType: "image/png" },
  });
  expect(nonImage.status()).toBe(400);

  const spoofedMime = await request.post("/api/vigilancia/transcription", {
    data: { imageBase64: onePixelPng.toString("base64"), mimeType: "image/jpeg" },
  });
  expect(spoofedMime.status()).toBe(400);

  const nonPdf = await request.post("/api/vigilancia/transcription", {
    data: { imageBase64: Buffer.from("contenido que no es un PDF").toString("base64"), mimeType: "application/pdf" },
  });
  expect(nonPdf.status()).toBe(400);

  const truncatedPdf = await request.post("/api/vigilancia/transcription", {
    data: { imageBase64: Buffer.from("%PDF-1.4\nsin cierre").toString("base64"), mimeType: "application/pdf" },
  });
  expect(truncatedPdf.status()).toBe(400);
});

test("mantiene los campos ilegibles vacíos y exige revisión manual", async ({ page, request }) => {
  await clearBedRecords(page);
  await request.put("/api/vigilancia/records/201-a", {
    data: {
      occupied: true,
      patientCode: "ANTERIOR-001",
      diagnosis: "Diagnóstico anterior",
      stayDays: 12,
      urinaryCatheterDays: 4,
      nasogastricTubeDays: null,
      centralLineDays: null,
      cultureType: "none",
      cultureStatus: "pending",
      cultureOrganism: "",
      culturePositiveDate: null,
      rectalSwabStatus: "pending",
      rectalSwabOrganism: "",
      rectalSwabPositiveDate: null,
      isolation: "none",
    },
  });
  await page.route("**/api/vigilancia/transcription", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [{
          bedId: "201-a",
          occupied: null,
          patientCode: null,
          diagnosis: null,
          stayDays: null,
          urinaryCatheterDays: null,
          nasogastricTubeDays: null,
          centralLineDays: null,
          cultureType: null,
          cultureStatus: null,
          cultureOrganism: null,
          culturePositiveDate: null,
          isolation: null,
          rectalSwabStatus: null,
          rectalSwabOrganism: null,
          rectalSwabPositiveDate: null,
          confidence: "low",
          warnings: ["Fila parcialmente ilegible."],
        }],
        warnings: [],
        reviewedRequired: true,
      }),
    });
  });
  await page.goto("/transcripcion");
  await page.getByTestId("input-census-image").setInputFiles({
    name: "censo-ilegible.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByTestId("button-transcribe-census").click();
  await expect(page.getByTestId("select-transcription-occupancy-0")).toHaveValue("unknown");
  await expect(page.getByTestId("input-transcription-code-0")).toHaveValue("");
  await expect(page.getByTestId("input-transcription-stayDays-0")).toHaveValue("");
  await expect(page.getByTestId("button-review-transcription")).toBeDisabled();
});

test("permite adaptar umbrales válidos y recalcula alertas existentes", async ({ page }) => {
  await clearBedRecords(page);
  await openBed(page, "201-b", "AUTO-CONFIG");
  await page.getByTestId("input-bed-urinary-days").fill("5");
  await page.getByTestId("button-save-bed-record").click();
  await expect(page.getByTestId("card-bed-201-b")).not.toContainText("señal");

  await page.goto("/configuracion");
  await expect(page.getByRole("heading", { name: "Configuración institucional" })).toBeVisible();
  await expect(page.getByTestId("current-threshold-urinaryCatheterDays")).toContainText("6");

  await page.getByTestId("input-threshold-centralLineDays").fill("31");
  await page.getByTestId("button-save-thresholds").click();
  await expect(page.getByRole("alert")).toContainText("entre 1 y 30 días");
  await expect(page.getByTestId("current-threshold-centralLineDays")).toContainText("7");

  await page.getByTestId("input-threshold-urinaryCatheterDays").fill("5");
  await page.getByTestId("input-threshold-centralLineDays").fill("7");
  await page.getByTestId("button-save-thresholds").click();
  await expect(page.getByTestId("threshold-save-success")).toHaveText("Guardado y recalculado");
  await expect(page.getByTestId("current-threshold-urinaryCatheterDays")).toContainText("5");

  await page.goto("/registro");
  await expect(page.getByTestId("card-bed-201-b")).toContainText("1 señal");
  await page.goto("/alertas");
  await expect(page.getByTestId("row-alert-auto-201-b-urinary-threshold")).toHaveCount(1);

  await page.goto("/configuracion");
  await page.reload();
  await expect(page.getByTestId("current-threshold-urinaryCatheterDays")).toContainText("5");
  await expect(page.getByText("No confirman una infección")).toBeVisible();
});
