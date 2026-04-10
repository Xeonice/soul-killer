/**
 * Skill slug formatter — converts free-form names (potentially containing
 * CJK, spaces, or special characters) into Anthropic Skill spec-compliant
 * `name` field values and archive path segments.
 *
 * Spec requirements (from
 * https://code.claude.com/docs/en/skills frontmatter reference):
 *   - Lowercase letters, digits, hyphens only
 *   - 1–64 characters
 *   - No leading/trailing hyphens
 *   - No consecutive hyphens
 *   - Regex: ^[a-z0-9]+(-[a-z0-9]+)*$
 *   - Must match the directory name containing SKILL.md
 *
 * The packager calls these formatters at archive build time so that the
 * end user never has to learn the spec rules — they can type a Chinese
 * story name like "FSN伊莉雅线" and the formatter produces a compliant
 * slug under the hood.
 *
 * Determinism guarantee: same input ⇒ same output, every time. This is
 * required because SKILL.md path references and archive file paths must
 * agree on the same slug for the same character / story name.
 */

const MAX_LEN = 64
/**
 * Reasonable length cap for the deterministic-hash fallback prefix so the
 * combined `${prefix}-${hash}` slug stays well under MAX_LEN.
 */
const FALLBACK_HASH_LEN = 8

/**
 * Strip everything that isn't an ASCII lowercase letter, digit, or hyphen,
 * then collapse and trim hyphens. Returns the empty string if nothing
 * survives — caller decides on a fallback.
 */
function stripToAsciiSlug(input: string): string {
  return input
    .toLowerCase()
    // Replace any whitespace with a hyphen so word breaks are preserved
    // before the non-ASCII filter strips everything else.
    .replace(/\s+/g, '-')
    // Drop everything outside the spec-allowed character set.
    .replace(/[^a-z0-9-]+/g, '')
    // Collapse runs of hyphens caused by adjacent stripped characters.
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens left by edge characters.
    .replace(/^-+|-+$/g, '')
}

/**
 * djb2 hash → unsigned 32-bit → base36, truncated to FALLBACK_HASH_LEN.
 * Pure function, no crypto dependency. Used to generate a stable fallback
 * slug for inputs that contain no ASCII content (e.g. pure CJK).
 */
function deterministicHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    // Bitwise ops force the result to a 32-bit int and stay in numeric mode
    // (string `hash` would silently corrupt the algorithm).
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  // Force unsigned then base36 for compactness.
  return ((hash >>> 0).toString(36)).padStart(FALLBACK_HASH_LEN, '0').slice(-FALLBACK_HASH_LEN)
}

/**
 * Trim a slug to MAX_LEN while keeping it spec-compliant. We have to be
 * careful: a naive `.slice(0, MAX_LEN)` could leave a trailing hyphen,
 * which violates the regex. We slice then re-trim trailing hyphens.
 */
function clampLength(slug: string): string {
  if (slug.length <= MAX_LEN) return slug
  return slug.slice(0, MAX_LEN).replace(/-+$/, '')
}

/**
 * Format a free-form name into a spec-compliant `name` field value.
 *
 * Falls back to `skill-<hash>` when the input has no ASCII content. The
 * fallback is deterministic in the input, so the same Chinese story name
 * always produces the same slug — this is what lets path references in
 * SKILL.md / archive entries stay in sync without explicit threading.
 */
export function formatSkillName(input: string): string {
  const stripped = stripToAsciiSlug(input)
  if (stripped.length > 0) {
    return clampLength(stripped)
  }
  return `skill-${deterministicHash(input)}`
}

/**
 * Format a free-form name into a spec-compliant archive path segment
 * (e.g. for `souls/<slug>/...` directories). Same rules as
 * `formatSkillName` but the fallback prefix is configurable so callers
 * can produce semantically meaningful fallbacks like `soul-<hash>` or
 * `world-<hash>`.
 *
 * @param input          The original (possibly non-ASCII) name.
 * @param fallbackPrefix Prefix for the deterministic fallback when stripping
 *                       leaves nothing. Must itself be a valid slug —
 *                       defaults to `seg`.
 */
export function formatPathSegment(input: string, fallbackPrefix: string = 'seg'): string {
  const stripped = stripToAsciiSlug(input)
  if (stripped.length > 0) {
    return clampLength(stripped)
  }
  // Sanitize the fallback prefix too — trust nothing.
  const safePrefix = stripToAsciiSlug(fallbackPrefix) || 'seg'
  return `${safePrefix}-${deterministicHash(input)}`
}

/**
 * Predicate for runtime / test verification that a given string already
 * matches the Anthropic Skill `name` regex. Useful for lint rules and
 * sanity checks.
 */
export function isValidSkillName(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LEN) return false
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
}

/**
 * Compute the combined `<storyName>-in-<worldName>` slug used as both the
 * archive file name and the frontmatter `name` field. Encapsulates the
 * formatter call + the join semantics in one place so callers can't
 * accidentally produce inconsistent values.
 */
export function formatSkillBaseName(storyName: string, worldName: string): string {
  const story = formatSkillName(storyName)
  const world = formatSkillName(worldName)
  // Both halves are guaranteed compliant; their join with a literal "-in-"
  // is also compliant because both halves are non-empty and end with a
  // valid character. Clamp again in case the combined string overflows.
  return clampLength(`${story}-in-${world}`)
}
