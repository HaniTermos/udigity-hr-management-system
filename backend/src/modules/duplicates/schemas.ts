/**
 * MOD-duplicates — DTOs. Owner: BE2. No HTTP routes and no actions of its own: the duplicate check is
 * `POST /api/businesses/duplicate-check` (action `business.duplicate_check`, MOD-business).
 */

/**
 * Shaping of a blocking match. `visible`: the caller may open the match (Owner always, C1).
 * `hidden` (approved D10, docs/policy-baseline-2026-10-29.md): a match the caller cannot otherwise access
 * reveals EXACTLY "this business already exists", the matched field type, the business name, its category
 * and its creation date. Never an id, phones, social links, notes or the assignee. Disclosure grants no access.
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
  | {
      visibility: 'hidden';
      matchedOn: 'name' | 'phone';
      name: string;
      categoryName: string;
      /** ISO timestamp of the match's creation. */
      createdAt: string;
    };

/** Fields of a hidden match (D10); the shape test asserts the response has these and nothing else. */
export const HIDDEN_MATCH_FIELDS = ['visibility', 'matchedOn', 'name', 'categoryName', 'createdAt'] as const;

/** DEC-013 SN-1 warning row. Only matches the caller may read are listed (no hint of hidden ones). */
export interface SimilarName {
  id: string;
  name: string;
  branch: string | null;
  similarity: number;
}
