import { describe, expect, test } from 'bun:test'
import { isTrustedScopeOrigin, parseScopeMessage, resolveTrustedScopeOrigin } from './scope-bridge'

describe('trusted Scope origin', () => {
  test('uses the canonical Scope origin unless overridden', () => {
    expect(resolveTrustedScopeOrigin()).toBe('https://model.scope.cloud')
    expect(resolveTrustedScopeOrigin('https://model.scope.cloud')).toBe('https://model.scope.cloud')
    expect(isTrustedScopeOrigin('https://model.scope.cloud')).toBe(true)
    expect(isTrustedScopeOrigin('https://evil.example')).toBe(false)
  })
})

describe('scope message validation', () => {
  test('accepts known messages with valid payloads', () => {
    expect(parseScopeMessage({ type: 'scope:init', payload: { appKey: 'app-123' } })).toMatchObject({
      type: 'scope:init',
      payload: { appKey: 'app-123' },
    })

    expect(parseScopeMessage({ type: 'scope:project', payload: { projectId: 'project-123' } })).toMatchObject({
      type: 'scope:project',
      payload: { projectId: 'project-123' },
    })

    expect(parseScopeMessage({ type: 'scope:user', payload: { user: { id: 'user-42' } } })).toMatchObject({
      type: 'scope:user',
      payload: { user: { id: 'user-42' } },
    })
  })

  test('rejects unknown message types and malformed payloads', () => {
    expect(parseScopeMessage({ type: 'scope:bogus', payload: {} })).toBeNull()
    expect(parseScopeMessage({ type: 'scope:init', payload: null })).toBeNull()
    expect(parseScopeMessage({ type: 'scope:project', payload: { projectId: 123 } })).toBeNull()
  })
})
