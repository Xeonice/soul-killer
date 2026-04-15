/**
 * Helpers for the entering-catalog-info wizard step (skill-catalog-autogen).
 * Kept in a plain `.ts` file (no ink/react) so they're easy to unit-test in
 * isolation from the `ExportCommand` component.
 */

/**
 * Normalize an LLM-produced slug candidate to a kebab-case ASCII form that
 * has the best chance of passing wizard validation. The author can still
 * reject the result and retype — this just gives them a sensible starting
 * point. Steps:
 *   1. lowercase
 *   2. underscore → hyphen (a common LLM output pattern)
 *   3. strip anything outside [a-z0-9-]
 *   4. collapse consecutive hyphens
 *   5. trim leading / trailing hyphens
 *
 * Returns '' when the input is entirely non-ASCII or otherwise unrecoverable;
 * the author then types a slug from scratch.
 */
export function normalizeSlugCandidate(s: string | undefined | null): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Validate a catalog-info wizard text input value for one sub-step. Returns
 * the i18n key of the error message when invalid, or `null` when the value
 * is acceptable. Mirrors the rules enforced by `validateCatalogFields` in
 * the LLM tool layer, so the wizard rejects any value the export agent
 * would also reject.
 */
export function validateCatalogSubStep(
  subStep: 'slug' | 'world' | 'summary',
  rawValue: string,
): string | null {
  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    return 'export.err.catalog.empty'
  }
  if (subStep === 'slug') {
    if (trimmed.length < 2 || trimmed.length > 32) {
      return 'export.err.catalog.slug_format'
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
      return 'export.err.catalog.slug_format'
    }
    return null
  }
  if (subStep === 'world') {
    if (trimmed.length > 40) {
      return 'export.err.catalog.world_name_length'
    }
    return null
  }
  // summary
  if (trimmed.length > 80) {
    return 'export.err.catalog.summary_length'
  }
  if (/[\r\n]/.test(trimmed)) {
    return 'export.err.catalog.summary_newline'
  }
  return null
}
