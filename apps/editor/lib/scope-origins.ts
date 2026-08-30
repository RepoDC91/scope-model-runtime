export const TRUSTED_SCOPE_ORIGINS = [
  'https://model.scope.cloud',
  'https://scope-master-copy-ce3dd2cb.base44.app',
] as const

export const DEFAULT_SCOPE_ORIGIN = TRUSTED_SCOPE_ORIGINS[0]

export function normalizeScopeOrigin(origin?: string | null): string | null {
  const trimmed = origin?.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function resolveConfiguredTrustedScopeOrigin(explicitOrigin?: string | null): string {
  const configured =
    explicitOrigin ??
    process.env.NEXT_PUBLIC_SCOPE_MODEL_ORIGIN ??
    process.env.SCOPE_MODEL_ORIGIN ??
    DEFAULT_SCOPE_ORIGIN

  const normalized = normalizeScopeOrigin(configured)
  if (!normalized) return DEFAULT_SCOPE_ORIGIN

  return TRUSTED_SCOPE_ORIGINS.includes(normalized as (typeof TRUSTED_SCOPE_ORIGINS)[number])
    ? normalized
    : DEFAULT_SCOPE_ORIGIN
}

export function isAllowedTrustedScopeOrigin(origin?: string | null): boolean {
  if (!origin) return false

  const normalized = normalizeScopeOrigin(origin)
  if (!normalized) return false

  return TRUSTED_SCOPE_ORIGINS.includes(normalized as (typeof TRUSTED_SCOPE_ORIGINS)[number])
}
