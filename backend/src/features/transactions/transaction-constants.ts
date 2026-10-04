import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "@workflow-demo/contracts";

/** Named constants for the transactions feature (plan §3, D-08). Single source of truth is the contract package's query schema; re-exported here so service/repository code never imports from `@workflow-demo/contracts` for a bare number. */
export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT };
