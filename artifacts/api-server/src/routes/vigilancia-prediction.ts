export type PredictionRecord = {
  bedId: string;
  occupied: boolean;
  urinaryCatheterDays: number | null;
  nasogastricTubeDays: number | null;
  centralLineDays: number | null;
  cultureStatus: string;
  culturePositiveDate: string | null;
  rectalSwabStatus: string;
  rectalSwabPositiveDate: string | null;
  isolation: string;
};

export type PredictionCoverage = {
  savedRecords: number;
  occupiedBeds: number;
  positiveCultures: number;
  positiveSwabs: number;
  datedPositiveResults: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type PredictionArea = {
  room: string;
  occupiedBeds: number;
  positiveResults: number;
  positiveCultures: number;
  positiveSwabs: number;
  deviceExposureBeds: number;
  isolationBeds: number;
};

export type PredictionEvidence = {
  evidenceWindowDays: number;
  recentDatedPositiveResults: number;
  minimumRecentDatedPositiveResults: number;
};

export function getMissingPredictionEvidence(input: {
  coverage: PredictionCoverage;
  evidence: PredictionEvidence;
}) {
  const positiveResults = input.coverage.positiveCultures + input.coverage.positiveSwabs;
  return [
    ...(input.coverage.occupiedBeds < 2 ? ["Al menos dos registros de camas ocupadas"] : []),
    ...(positiveResults < 2 ? ["Al menos dos resultados microbiológicos positivos"] : []),
    ...(input.evidence.recentDatedPositiveResults < input.evidence.minimumRecentDatedPositiveResults
      ? [`Al menos dos resultados positivos fechados en los últimos ${input.evidence.evidenceWindowDays} días`]
      : []),
  ];
}

export function buildOutbreakPredictionInput(
  records: PredictionRecord[],
  bedRooms: ReadonlyMap<string, string>,
  currentDate = new Date(),
) {
  const occupiedRecords = records.filter((record) => record.occupied);
  const positiveDates = occupiedRecords.flatMap((record) => [
    record.cultureStatus === "positive" ? record.culturePositiveDate : null,
    record.rectalSwabStatus === "positive" ? record.rectalSwabPositiveDate : null,
  ]).filter((date): date is string => Boolean(date));
  const sortedDates = [...positiveDates].sort();
  const currentDay = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
  const evidenceWindowDays = 30;
  const recentDatedPositiveResults = positiveDates.filter((date) => {
    const resultDay = Date.parse(`${date}T00:00:00.000Z`);
    const ageDays = (currentDay - resultDay) / 86_400_000;
    return Number.isFinite(resultDay) && ageDays >= 0 && ageDays <= evidenceWindowDays;
  }).length;
  const coverage: PredictionCoverage = {
    savedRecords: records.length,
    occupiedBeds: occupiedRecords.length,
    positiveCultures: occupiedRecords.filter((record) => record.cultureStatus === "positive").length,
    positiveSwabs: occupiedRecords.filter((record) => record.rectalSwabStatus === "positive").length,
    datedPositiveResults: positiveDates.length,
    periodStart: sortedDates[0] ?? null,
    periodEnd: sortedDates.at(-1) ?? null,
  };

  const areaMap = new Map<string, PredictionArea>();
  for (const record of occupiedRecords) {
    const room = bedRooms.get(record.bedId) ?? "Sin sala identificada";
    const area = areaMap.get(room) ?? {
      room,
      occupiedBeds: 0,
      positiveResults: 0,
      positiveCultures: 0,
      positiveSwabs: 0,
      deviceExposureBeds: 0,
      isolationBeds: 0,
    };
    const positiveCulture = record.cultureStatus === "positive";
    const positiveSwab = record.rectalSwabStatus === "positive";
    area.occupiedBeds += 1;
    area.positiveCultures += Number(positiveCulture);
    area.positiveSwabs += Number(positiveSwab);
    area.positiveResults += Number(positiveCulture) + Number(positiveSwab);
    area.deviceExposureBeds += Number(
      Number(record.urinaryCatheterDays ?? 0) > 0
      || Number(record.nasogastricTubeDays ?? 0) > 0
      || Number(record.centralLineDays ?? 0) > 0,
    );
    area.isolationBeds += Number(record.isolation !== "none");
    areaMap.set(room, area);
  }

  return {
    coverage,
    areas: [...areaMap.values()],
    evidence: {
      evidenceWindowDays,
      recentDatedPositiveResults,
      minimumRecentDatedPositiveResults: 2,
    },
    dataLimitations: [
      "La base contiene el estado operativo actual, no una serie histórica completa.",
      "Los conteos representan señales registradas y no confirman infección ni transmisión.",
    ],
  };
}