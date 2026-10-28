/**
 * MOD-duplicates — HTTP routes. Owner: BE2. Status: STUB (scaffold by Tech Lead).
 * Contract and conventions: docs/implementation/plan.md.
 */
// Pattern: authenticate -> requireAction('<resource>.<verb>') -> Zod parse -> service (runCommand) -> JSON.
// Endpoint list: plan.md §4.1.
import { Router } from 'express';

/** This module exposes no HTTP routes (internal service). */
const router = Router();

export default router;
