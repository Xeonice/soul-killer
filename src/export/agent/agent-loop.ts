// Re-export from infra — this module was moved to src/infra/agent/agent-loop.ts
// Kept here for backward compatibility with existing export-side imports.
export {
  runAgentLoop,
  classifyApiError,
  extractApiErrorMessage,
  toUserFacingError,
  type AgentLoopOptions,
  type AgentLoopResult,
  type ApiErrorInfo,
} from '../../infra/agent/agent-loop.js'
