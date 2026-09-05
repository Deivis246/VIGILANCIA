import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const vigilanciaBedRecordsTable = pgTable("vigilancia_bed_records", {
  bedId: text("bed_id").primaryKey(),
  occupied: boolean("occupied").notNull(),
  patientCode: text("patient_code").notNull(),
  age: integer("age"),
  affiliation: text("affiliation"),
  diagnosis: text("diagnosis").notNull().default(""),
  stayDays: integer("stay_days"),
  urinaryCatheterDays: integer("urinary_catheter_days"),
  nasogastricTubeDays: integer("nasogastric_tube_days"),
  centralLineDays: integer("central_line_days"),
  drainDays: integer("drain_days"),
  dialysisCatheterDays: integer("dialysis_catheter_days"),
  cultureType: text("culture_type").notNull(),
  cultureStatus: text("culture_status").notNull(),
  cultureOrganism: text("culture_organism").notNull(),
  culturePositiveDate: date("culture_positive_date", { mode: "string" }),
  rectalSwabStatus: text("rectal_swab_status").notNull(),
  rectalSwabOrganism: text("rectal_swab_organism").notNull(),
  rectalSwabPositiveDate: date("rectal_swab_positive_date", { mode: "string" }),
  isolation: text("isolation").notNull(),
  censusDate: date("census_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVigilanciaBedRecordSchema = createInsertSchema(vigilanciaBedRecordsTable).omit({
  updatedAt: true,
});

export type InsertVigilanciaBedRecord = typeof vigilanciaBedRecordsTable.$inferInsert;
export type VigilanciaBedRecord = typeof vigilanciaBedRecordsTable.$inferSelect;