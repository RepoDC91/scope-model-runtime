'use client'

import { useScene } from '@pascal-app/core'
import { applySceneGraphToEditor, type SceneGraph } from '@pascal-app/editor'
import { useEffect } from 'react'

export const DEFAULT_SCOPE_ORIGIN = 'https://model.scope.cloud'

export type ScopeMessageType =
  | 'scope:init'
  | 'scope:project'
  | 'scope:user'
  | 'scope:load'
  | 'scope:save'

export type ScopeUser = {
  id: string
  email?: string
  name?: string
  avatarUrl?: string
  role?: string
}

export type ScopeProjectMetadata = Record<string, unknown>

export type ScopeHostContext = {
  projectId: string | null
  appKey: string | null
  user: ScopeUser | null
  project: {
    id: string | null
    metadata: ScopeProjectMetadata
  } | null
}

const EMPTY_SCOPE_CONTEXT: ScopeHostContext = {
  projectId: null,
  appKey: null,
  user: null,
  project: null,
}

let currentScopeContext: ScopeHostContext = { ...EMPTY_SCOPE_CONTEXT }

export function resolveTrustedScopeOrigin(explicitOrigin?: string | null): string {
  const configured =
    explicitOrigin ??
    process.env.NEXT_PUBLIC_SCOPE_MODEL_ORIGIN ??
    process.env.SCOPE_MODEL_ORIGIN ??
    DEFAULT_SCOPE_ORIGIN

  const trimmed = configured?.trim()
  if (!trimmed) {
    return DEFAULT_SCOPE_ORIGIN
  }

  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function isTrustedScopeOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false

  try {
    return new URL(origin).origin === resolveTrustedScopeOrigin()
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeUser(value: unknown): ScopeUser | null {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null
  if (!id) return null

  return {
    id,
    email: typeof value.email === 'string' ? value.email : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    role: typeof value.role === 'string' ? value.role : undefined,
  }
}

function normalizeMetadata(value: unknown): ScopeProjectMetadata {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as ScopeProjectMetadata
}

export function getScopeHostContext(): ScopeHostContext {
  return currentScopeContext
}

export function applyScopeMessage(data: unknown): ScopeHostContext | null {
  const parsed = parseScopeMessage(data)
  if (!parsed) return null

  const nextContext: ScopeHostContext = { ...currentScopeContext }

  switch (parsed.type) {
    case 'scope:init': {
      const appKey = typeof parsed.payload.appKey === 'string' ? parsed.payload.appKey : null
      nextContext.appKey = appKey
      break
    }
    case 'scope:project': {
      const projectId = typeof parsed.payload.projectId === 'string' ? parsed.payload.projectId : null
      nextContext.projectId = projectId
      nextContext.project = {
        id: projectId,
        metadata: normalizeMetadata(parsed.payload.metadata),
      }
      break
    }
    case 'scope:user': {
      nextContext.user = normalizeUser(parsed.payload.user)
      break
    }
    case 'scope:load': {
      const projectId = typeof parsed.payload.projectId === 'string' ? parsed.payload.projectId : null
      if (projectId) nextContext.projectId = projectId
      if (parsed.payload.project) {
        nextContext.project = {
          id: projectId ?? nextContext.projectId,
          metadata: normalizeMetadata(parsed.payload.project.metadata),
        }
      }
      break
    }
    case 'scope:save': {
      const projectId = typeof parsed.payload.projectId === 'string' ? parsed.payload.projectId : null
      if (projectId) nextContext.projectId = projectId
      if (parsed.payload.project) {
        nextContext.project = {
          id: projectId ?? nextContext.projectId,
          metadata: normalizeMetadata(parsed.payload.project.metadata),
        }
      }
      break
    }
    default:
      return null
  }

  currentScopeContext = nextContext
  return currentScopeContext
}

export type ScopeMessageEnvelope = {
  type: ScopeMessageType
  payload: Record<string, unknown>
}

export function parseScopeMessage(data: unknown): ScopeMessageEnvelope | null {
  if (!isRecord(data)) return null

  const type = data.type
  if (typeof type !== 'string') return null

  const allowedTypes: readonly ScopeMessageType[] = [
    'scope:init',
    'scope:project',
    'scope:user',
    'scope:load',
    'scope:save',
  ]

  if (!(allowedTypes as readonly string[]).includes(type)) return null

  const payload = data.payload
  if (!isRecord(payload)) return null

  switch (type) {
    case 'scope:init':
      return typeof payload.appKey === 'string' && payload.appKey.trim() ? { type, payload } : null
    case 'scope:project':
      return typeof payload.projectId === 'string' && payload.projectId.trim() ? { type, payload } : null
    case 'scope:user':
      return normalizeUser(payload.user) ? { type, payload } : null
    case 'scope:load':
      return (
        (typeof payload.projectId === 'string' && payload.projectId.trim()) ||
        isRecord(payload.scene) ||
        typeof payload.scene === 'string' ||
        payload.scene === null ||
        typeof payload.projectId === 'undefined'
      )
        ? { type, payload }
        : null
    case 'scope:save':
      return (
        (typeof payload.projectId === 'string' && payload.projectId.trim()) ||
        isRecord(payload.scene) ||
        typeof payload.scene === 'string' ||
        payload.scene === null ||
        typeof payload.projectId === 'undefined'
      )
        ? { type, payload }
        : null
    default:
      return null
  }
}

function isSceneGraphShape(value: unknown): value is SceneGraph {
  if (!isRecord(value)) return false
  return (
    isRecord(value.nodes) &&
    Array.isArray(value.rootNodeIds) &&
    (typeof value.materials === 'undefined' || isRecord(value.materials)) &&
    (typeof value.collections === 'undefined' || isRecord(value.collections))
  )
}

function safeLoadScene(): SceneGraph | null {
  const stored = loadSceneFromLocalStorage()
  return stored
}

export function useScopeBridge({
  onLoadScene,
  onSaveScene,
}: {
  onLoadScene?: () => Promise<SceneGraph | null> | SceneGraph | null
  onSaveScene?: (scene: SceneGraph) => Promise<void> | void
} = {}) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const trustedOrigin = resolveTrustedScopeOrigin()
    const sendReady = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'pascal:ready' }, trustedOrigin)
      }
    }

    const handleMessage = async (event: MessageEvent) => {
      if (!isTrustedScopeOrigin(event.origin)) {
        return
      }

      const parsed = parseScopeMessage(event.data)
      if (!parsed) {
        return
      }

      applyScopeMessage(parsed)

      switch (parsed.type) {
        case 'scope:init': {
          sendReady()
          break
        }
        case 'scope:load': {
          const payloadScene = parsed.payload.scene
          const nextScene = isSceneGraphShape(payloadScene)
            ? payloadScene
            : typeof onLoadScene === 'function'
              ? await onLoadScene()
              : safeLoadScene()

          if (nextScene) {
            applySceneGraphToEditor(nextScene)
          } else {
            applySceneGraphToEditor(null)
          }
          break
        }
        case 'scope:save': {
          const scene = isSceneGraphShape(parsed.payload.scene)
            ? parsed.payload.scene
            : {
                nodes: useScene.getState().nodes,
                rootNodeIds: useScene.getState().rootNodeIds,
                collections: useScene.getState().collections,
                materials: useScene.getState().materials,
                installedPlugins: useScene.getState().installedPlugins,
              }

          if (typeof onSaveScene === 'function') {
            await onSaveScene(scene)
            return
          }

          saveSceneToLocalStorage(scene)
          break
        }
        default:
          break
      }
    }

    sendReady()
    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [onLoadScene, onSaveScene])
}

export function ScopeBridgeMount({
  onLoadScene,
  onSaveScene,
  onDirty,
  onSaveStatusChange,
}: {
  onLoadScene?: () => Promise<SceneGraph | null> | SceneGraph | null
  onSaveScene?: (scene: SceneGraph) => Promise<void> | void
  onDirty?: () => void
  onSaveStatusChange?: (status: string) => void
} = {}) {
  useScopeBridge({ onLoadScene, onSaveScene })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const trustedOrigin = resolveTrustedScopeOrigin()

    const onChange = () => {
      onDirty?.()
      if (typeof onSaveStatusChange !== 'function') return
      const status = getScopeHostContext().projectId ? 'saved' : 'error'
      onSaveStatusChange(status)
    }

    const handleMessage = (event: MessageEvent) => {
      if (!isTrustedScopeOrigin(event.origin)) return
      if (event.data?.type === 'scope:init' || event.data?.type === 'scope:project') {
        onChange()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onDirty, onSaveStatusChange])

  return null
}
