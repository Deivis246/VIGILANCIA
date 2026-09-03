import { eq } from "drizzle-orm";
import { db, vigilanciaBedRecordsTable } from "@workspace/db";

export type VigilanciaBedRecordOperation =
  | { kind: "delete"; bedId: string }
  | { kind: "upsert"; values: typeof vigilanciaBedRecordsTable.$inferInsert };

type ApplyOperationsOptions = {
  afterOperation?: (operationIndex: number) => void | Promise<void>;
};

export async function applyVigilanciaBedRecordOperations(
  operations: VigilanciaBedRecordOperation[],
  options: ApplyOperationsOptions = {},
) {
  await db.transaction(async (tx) => {
    for (const [index, operation] of operations.entries()) {
      if (operation.kind === "delete") {
        await tx
          .delete(vigilanciaBedRecordsTable)
          .where(eq(vigilanciaBedRecordsTable.bedId, operation.bedId));
      } else {
        await tx
          .insert(vigilanciaBedRecordsTable)
          .values(operation.values)
          .onConflictDoUpdate({
            target: vigilanciaBedRecordsTable.bedId,
            set: operation.values,
          });
      }

      await options.afterOperation?.(index);
    }
  });
}