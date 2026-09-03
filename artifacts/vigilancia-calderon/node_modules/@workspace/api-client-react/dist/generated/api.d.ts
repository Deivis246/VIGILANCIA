import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { GetVigilanciaDashboardParams, HealthStatus, VigilanciaAlert, VigilanciaBedRecord, VigilanciaBedRecordInput, VigilanciaCensusApplyInput, VigilanciaCensusApplyResponse, VigilanciaDashboard, VigilanciaOutbreakPrediction, VigilanciaTranscriptionRequest, VigilanciaTranscriptionResponse } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetVigilanciaDashboardUrl: (params?: GetVigilanciaDashboardParams) => string;
/**
 * Returns the operational summary, alert queue, bed map, and trend series for the clinical areas floor.
 * @summary Get clinical surveillance dashboard
 */
export declare const getVigilanciaDashboard: (params?: GetVigilanciaDashboardParams, options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaDashboard>;
export declare const getGetVigilanciaDashboardQueryKey: (params?: GetVigilanciaDashboardParams) => readonly ["/api/vigilancia/dashboard", ...GetVigilanciaDashboardParams[]];
export declare const getGetVigilanciaDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getVigilanciaDashboard>>, TError = ErrorType<unknown>>(params?: GetVigilanciaDashboardParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetVigilanciaDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getVigilanciaDashboard>>>;
export type GetVigilanciaDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get clinical surveillance dashboard
 */
export declare function useGetVigilanciaDashboard<TData = Awaited<ReturnType<typeof getVigilanciaDashboard>>, TError = ErrorType<unknown>>(params?: GetVigilanciaDashboardParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetVigilanciaAlertsUrl: () => string;
/**
 * @summary List current clinical alerts
 */
export declare const getVigilanciaAlerts: (options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaAlert[]>;
export declare const getGetVigilanciaAlertsQueryKey: () => readonly ["/api/vigilancia/alerts"];
export declare const getGetVigilanciaAlertsQueryOptions: <TData = Awaited<ReturnType<typeof getVigilanciaAlerts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaAlerts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaAlerts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetVigilanciaAlertsQueryResult = NonNullable<Awaited<ReturnType<typeof getVigilanciaAlerts>>>;
export type GetVigilanciaAlertsQueryError = ErrorType<unknown>;
/**
 * @summary List current clinical alerts
 */
export declare function useGetVigilanciaAlerts<TData = Awaited<ReturnType<typeof getVigilanciaAlerts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaAlerts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPredictVigilanciaOutbreakUrl: () => string;
/**
 * Runs an on-demand, privacy-minimized Gemini analysis over current operational bed records. The result is an orienting signal, not a diagnosis or outbreak confirmation.
 * @summary Analyze outbreak signals from saved surveillance records
 */
export declare const predictVigilanciaOutbreak: (options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaOutbreakPrediction>;
export declare const getPredictVigilanciaOutbreakMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof predictVigilanciaOutbreak>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof predictVigilanciaOutbreak>>, TError, void, TContext>;
export type PredictVigilanciaOutbreakMutationResult = NonNullable<Awaited<ReturnType<typeof predictVigilanciaOutbreak>>>;
export type PredictVigilanciaOutbreakMutationError = ErrorType<void>;
/**
* @summary Analyze outbreak signals from saved surveillance records
*/
export declare const usePredictVigilanciaOutbreak: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof predictVigilanciaOutbreak>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof predictVigilanciaOutbreak>>, TError, void, TContext>;
export declare const getTranscribeVigilanciaCensusUrl: () => string;
/**
 * Reads a permitted census image or PDF through the direct AI provider. The file is not persisted and the result must be reviewed before applying it.
 * @summary Transcribe a temporary census image or PDF
 */
export declare const transcribeVigilanciaCensus: (vigilanciaTranscriptionRequest: VigilanciaTranscriptionRequest, options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaTranscriptionResponse>;
export declare const getTranscribeVigilanciaCensusMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof transcribeVigilanciaCensus>>, TError, {
        data: BodyType<VigilanciaTranscriptionRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof transcribeVigilanciaCensus>>, TError, {
    data: BodyType<VigilanciaTranscriptionRequest>;
}, TContext>;
export type TranscribeVigilanciaCensusMutationResult = NonNullable<Awaited<ReturnType<typeof transcribeVigilanciaCensus>>>;
export type TranscribeVigilanciaCensusMutationBody = BodyType<VigilanciaTranscriptionRequest>;
export type TranscribeVigilanciaCensusMutationError = ErrorType<void>;
/**
* @summary Transcribe a temporary census image or PDF
*/
export declare const useTranscribeVigilanciaCensus: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof transcribeVigilanciaCensus>>, TError, {
        data: BodyType<VigilanciaTranscriptionRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof transcribeVigilanciaCensus>>, TError, {
    data: BodyType<VigilanciaTranscriptionRequest>;
}, TContext>;
export declare const getGetVigilanciaBedRecordsUrl: () => string;
/**
 * @summary List saved bed records
 */
export declare const getVigilanciaBedRecords: (options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaBedRecord[]>;
export declare const getGetVigilanciaBedRecordsQueryKey: () => readonly ["/api/vigilancia/records"];
export declare const getGetVigilanciaBedRecordsQueryOptions: <TData = Awaited<ReturnType<typeof getVigilanciaBedRecords>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaBedRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaBedRecords>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetVigilanciaBedRecordsQueryResult = NonNullable<Awaited<ReturnType<typeof getVigilanciaBedRecords>>>;
export type GetVigilanciaBedRecordsQueryError = ErrorType<unknown>;
/**
 * @summary List saved bed records
 */
export declare function useGetVigilanciaBedRecords<TData = Awaited<ReturnType<typeof getVigilanciaBedRecords>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVigilanciaBedRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getApplyVigilanciaCensusUrl: () => string;
/**
 * Validates every selected bed before applying all record updates and releases in one database transaction.
 * @summary Apply reviewed census rows atomically
 */
export declare const applyVigilanciaCensus: (vigilanciaCensusApplyInput: VigilanciaCensusApplyInput, options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaCensusApplyResponse>;
export declare const getApplyVigilanciaCensusMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyVigilanciaCensus>>, TError, {
        data: BodyType<VigilanciaCensusApplyInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof applyVigilanciaCensus>>, TError, {
    data: BodyType<VigilanciaCensusApplyInput>;
}, TContext>;
export type ApplyVigilanciaCensusMutationResult = NonNullable<Awaited<ReturnType<typeof applyVigilanciaCensus>>>;
export type ApplyVigilanciaCensusMutationBody = BodyType<VigilanciaCensusApplyInput>;
export type ApplyVigilanciaCensusMutationError = ErrorType<void>;
/**
* @summary Apply reviewed census rows atomically
*/
export declare const useApplyVigilanciaCensus: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyVigilanciaCensus>>, TError, {
        data: BodyType<VigilanciaCensusApplyInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof applyVigilanciaCensus>>, TError, {
    data: BodyType<VigilanciaCensusApplyInput>;
}, TContext>;
export declare const getUpsertVigilanciaBedRecordUrl: (bedId: string) => string;
/**
 * @summary Save an operational bed record
 */
export declare const upsertVigilanciaBedRecord: (bedId: string, vigilanciaBedRecordInput: VigilanciaBedRecordInput, options?: Parameters<typeof customFetch>[1]) => Promise<VigilanciaBedRecord>;
export declare const getUpsertVigilanciaBedRecordMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof upsertVigilanciaBedRecord>>, TError, {
        bedId: string;
        data: BodyType<VigilanciaBedRecordInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof upsertVigilanciaBedRecord>>, TError, {
    bedId: string;
    data: BodyType<VigilanciaBedRecordInput>;
}, TContext>;
export type UpsertVigilanciaBedRecordMutationResult = NonNullable<Awaited<ReturnType<typeof upsertVigilanciaBedRecord>>>;
export type UpsertVigilanciaBedRecordMutationBody = BodyType<VigilanciaBedRecordInput>;
export type UpsertVigilanciaBedRecordMutationError = ErrorType<void>;
/**
* @summary Save an operational bed record
*/
export declare const useUpsertVigilanciaBedRecord: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof upsertVigilanciaBedRecord>>, TError, {
        bedId: string;
        data: BodyType<VigilanciaBedRecordInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof upsertVigilanciaBedRecord>>, TError, {
    bedId: string;
    data: BodyType<VigilanciaBedRecordInput>;
}, TContext>;
export declare const getDeleteVigilanciaBedRecordUrl: (bedId: string) => string;
/**
 * @summary Release a bed and remove its saved record
 */
export declare const deleteVigilanciaBedRecord: (bedId: string, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteVigilanciaBedRecordMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteVigilanciaBedRecord>>, TError, {
        bedId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteVigilanciaBedRecord>>, TError, {
    bedId: string;
}, TContext>;
export type DeleteVigilanciaBedRecordMutationResult = NonNullable<Awaited<ReturnType<typeof deleteVigilanciaBedRecord>>>;
export type DeleteVigilanciaBedRecordMutationError = ErrorType<void>;
/**
* @summary Release a bed and remove its saved record
*/
export declare const useDeleteVigilanciaBedRecord: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteVigilanciaBedRecord>>, TError, {
        bedId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteVigilanciaBedRecord>>, TError, {
    bedId: string;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map