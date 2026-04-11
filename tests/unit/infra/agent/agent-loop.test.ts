import { describe, it, expect } from 'vitest'
import { classifyApiError, extractApiErrorMessage, toUserFacingError } from '../../../../src/infra/agent/agent-loop.js'

describe('extractApiErrorMessage', () => {
  it('extracts message from nested data.error.message', () => {
    const err = { statusCode: 402, data: { error: { message: 'Insufficient credits' } } }
    expect(extractApiErrorMessage(err)).toBe('API error 402: Insufficient credits')
  })

  it('extracts message from error.message', () => {
    const err = { statusCode: 401, message: 'Invalid API key' }
    expect(extractApiErrorMessage(err)).toBe('API error 401: Invalid API key')
  })

  it('strips error class prefix from message', () => {
    const err = { message: 'APICallError [AI_APICallError]: No credits remaining' }
    expect(extractApiErrorMessage(err)).toBe('No credits remaining')
  })

  it('falls back to String() for non-object errors', () => {
    expect(extractApiErrorMessage('raw string error')).toBe('raw string error')
    expect(extractApiErrorMessage(42)).toBe('42')
    expect(extractApiErrorMessage(null)).toBe('null')
  })

  it('handles message without statusCode', () => {
    const err = { message: 'Network failure' }
    expect(extractApiErrorMessage(err)).toBe('Network failure')
  })

  it('handles data.error.message without statusCode', () => {
    const err = { data: { error: { message: 'Something went wrong' } } }
    expect(extractApiErrorMessage(err)).toBe('Something went wrong')
  })
})

describe('classifyApiError', () => {
  it('detects 402 payment error from statusCode', () => {
    const err = { statusCode: 402, message: 'Payment required' }
    const info = classifyApiError(err)
    expect(info.isPayment).toBe(true)
    expect(info.isAuth).toBe(false)
    expect(info.isRateLimit).toBe(false)
    expect(info.statusCode).toBe(402)
  })

  it('detects 401 auth error from statusCode', () => {
    const err = { statusCode: 401, message: 'Unauthorized' }
    const info = classifyApiError(err)
    expect(info.isPayment).toBe(false)
    expect(info.isAuth).toBe(true)
    expect(info.isRateLimit).toBe(false)
    expect(info.statusCode).toBe(401)
  })

  it('detects 429 rate limit from statusCode', () => {
    const err = { statusCode: 429, message: 'Too many requests' }
    const info = classifyApiError(err)
    expect(info.isPayment).toBe(false)
    expect(info.isAuth).toBe(false)
    expect(info.isRateLimit).toBe(true)
    expect(info.statusCode).toBe(429)
  })

  it('detects status code from error message when statusCode property is missing', () => {
    const err = { message: 'APICallError: API error 402: No credits' }
    const info = classifyApiError(err)
    expect(info.isPayment).toBe(true)
    expect(info.statusCode).toBe(402)
  })

  it('detects 429 from error message', () => {
    const err = { message: 'Rate limited, status 429' }
    const info = classifyApiError(err)
    expect(info.isRateLimit).toBe(true)
    expect(info.statusCode).toBe(429)
  })

  it('returns no special flags for non-payment errors', () => {
    const err = { statusCode: 500, message: 'Internal server error' }
    const info = classifyApiError(err)
    expect(info.isPayment).toBe(false)
    expect(info.isAuth).toBe(false)
    expect(info.isRateLimit).toBe(false)
    expect(info.statusCode).toBe(500)
  })

  it('handles errors with status instead of statusCode', () => {
    const err = { status: 402, message: 'Pay up' }
    const info = classifyApiError(err)
    expect(info.isPayment).toBe(true)
    expect(info.statusCode).toBe(402)
  })

  it('handles plain string errors', () => {
    const info = classifyApiError('something broke')
    expect(info.isPayment).toBe(false)
    expect(info.isAuth).toBe(false)
    expect(info.isRateLimit).toBe(false)
    expect(info.statusCode).toBeUndefined()
    expect(info.message).toBe('something broke')
  })
})

describe('toUserFacingError', () => {
  it('returns payment message for 402', () => {
    const msg = toUserFacingError({ statusCode: 402, message: 'x', isPayment: true, isAuth: false, isRateLimit: false })
    expect(msg).toContain('API')
    expect(msg.length).toBeGreaterThan(5)
  })

  it('returns auth message for 401', () => {
    const msg = toUserFacingError({ statusCode: 401, message: 'x', isPayment: false, isAuth: true, isRateLimit: false })
    expect(msg).toContain('API')
    expect(msg.length).toBeGreaterThan(5)
  })

  it('returns rate limit message for 429', () => {
    const msg = toUserFacingError({ statusCode: 429, message: 'x', isPayment: false, isAuth: false, isRateLimit: true })
    expect(msg).toContain('API')
    expect(msg.length).toBeGreaterThan(5)
  })

  it('falls back to raw message for other errors', () => {
    const msg = toUserFacingError({ statusCode: 500, message: 'Internal error', isPayment: false, isAuth: false, isRateLimit: false })
    expect(msg).toBe('Internal error')
  })
})
