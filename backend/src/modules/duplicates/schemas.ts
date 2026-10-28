/**
 * MOD-duplicates — DTOs. Owner: BE2. No HTTP routes and no actions of its own: the duplicate check is
 * `POST /api/businesses/duplicate-check` (action `business.duplicate_check`, MOD-business).
 */

/**
 * DEC-003 (i) shaping of a blocking match (Demonstration alternative — not approved).
 * `visible`: the caller may open the match (Owner always, C1). `hidden`: existence only — no id, no field.
 */
export type DuplicateMatch =
  | {
      visibility: 'visible';
      id: string;
      name: string;
      branch: string | null;
      matchedOn: 'name' | 'phone';
      /** The caller's own value that matched (normalised phone or name). */
      matchedValue: string;
      /** Normalised phones of the match. */
      phones: string[];
      archived: boolean;
    }
  | { visibility: 'hidden' };

/** DEC-013 SN-1 warning row. Only matches the caller may read are listed (no hint of hidden ones). */
export interface SimilarName {
  id: string;
  name: string;
  branch: string | null;
  similarity: number;
}
