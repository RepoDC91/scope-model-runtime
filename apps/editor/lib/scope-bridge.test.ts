import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_SCOPE_ORIGIN,
  FRAME_ANCESTOR_ORIGINS,
  TRUSTED_SCOPE_ORIGINS,
  isAllowedTrustedScopeOrigin,
  postToTrustedScopeParents,
  resolveConfiguredTrustedScopeOrigin,
} from './scope-origins'

describe('trusted Scope origin', () => {
  test('allows only the approved production and Base44 preview origins', () => {
    expect(TRUSTED_SCOPE_ORIGINS).toEqual([
      'https://model.scope.cloud',
      'https://scope-master-copy-ce3dd2cb.base44.app',
    ])
    expect(FRAME_ANCESTOR_ORIGINS).toEqual([
      'https://model.scope.cloud',
      'https://scope-master-copy-ce3dd2cb.base44.app',
      'https://app.base44.com',
    ])
    expect(DEFAULT_SCOPE_ORIGIN).toBe('https://model.scope.cloud')
    expect(resolveConfiguredTrustedScopeOrigin()).toBe('https://model.scope.cloud')
    expect(resolveConfiguredTrustedScopeOrigin('https://model.scope.cloud')).toBe(
      'https://model.scope.cloud',
    )
    expect(resolveConfiguredTrustedScopeOrigin('https://scope-master-copy-ce3dd2cb.base44.app')).toBe(
      'https://scope-master-copy-ce3dd2cb.base44.app',
    )
    expect(isAllowedTrustedScopeOrigin('https://model.scope.cloud')).toBe(true)
    expect(isAllowedTrustedScopeOrigin('https://scope-master-copy-ce3dd2cb.base44.app')).toBe(true)
    expect(isAllowedTrustedScopeOrigin('https://app.base44.com')).toBe(false)
    expect(isAllowedTrustedScopeOrigin('https://evil.example')).toBe(false)
    expect(isAllowedTrustedScopeOrigin('https://scope-master-copy-ce3dd2cb.base44.app.evil')).toBe(false)
    expect(isAllowedTrustedScopeOrigin('https://random.base44.app')).toBe(false)
  })

  test('posts Pascal bridge events to every trusted parent origin and never to wildcard', () => {
    const calls: Array<{ message: unknown; targetOrigin: string }> = []
    const parent = {
      postMessage: (message: unknown, targetOrigin: string) => {
        calls.push({ message, targetOrigin })
      },
    } as Pick<Window, 'postMessage'>

    postToTrustedScopeParents({ type: 'pascal:ready' }, parent)
    postToTrustedScopeParents({ type: 'pascal:dirty' }, parent)

    expect(calls).toEqual([
      { message: { type: 'pascal:ready' }, targetOrigin: 'https://model.scope.cloud' },
      { message: { type: 'pascal:ready' }, targetOrigin: 'https://scope-master-copy-ce3dd2cb.base44.app' },
      { message: { type: 'pascal:dirty' }, targetOrigin: 'https://model.scope.cloud' },
      { message: { type: 'pascal:dirty' }, targetOrigin: 'https://scope-master-copy-ce3dd2cb.base44.app' },
    ])
    expect(calls.every(({ targetOrigin }) => targetOrigin !== '*')).toBe(true)
    expect(calls.some(({ targetOrigin }) => targetOrigin === 'https://evil.example')).toBe(false)
  })
})
