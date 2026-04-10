/**
 * Skill spec formatter — Anthropic Skill spec compliance helpers used by
 * the packager. Pure functions, no side effects.
 *
 * Why a formatter (rather than only a lint): the spec rules are
 * deterministic — given any free-form input there is exactly one correct
 * compliant output. Asking the user to learn the rules is friction; the
 * packager should just produce the right thing.
 */
export {
  formatSkillName,
  formatPathSegment,
  formatSkillBaseName,
  isValidSkillName,
} from './skill-slug.js'
