/**
 * MOD-identity — repository (raw parameterised SQL on this module's own tables only). Owner: BE1. Status: STUB (scaffold by Tech Lead).
 * Contract and conventions: docs/implementation/plan.md.
 */
// Owned tables: credentials, two_factor_factors, sessions, security_tokens (+ recovery codes, counters).
// Every function takes a Queryable (pool or ctx.tx) as its first argument.
export {};
