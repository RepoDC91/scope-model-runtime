import { applySceneGraphToEditor as applySceneGraphToEditorFromPackage, type SceneGraph } from '@pascal-app/editor'

export type { SceneGraph } from '@pascal-app/editor'

export function applySceneGraphToEditor(sceneGraph?: SceneGraph | null) {
  return applySceneGraphToEditorFromPackage(sceneGraph)
}

export function saveSceneToLocalStorage(scene: SceneGraph): void {
  try {
    window.localStorage.setItem('pascal-editor-scene', JSON.stringify(scene))
  } catch {
    // Swallow storage quota errors.
  }
}

export function loadSceneFromLocalStorage(): SceneGraph | null {
  try {
    const raw = window.localStorage.getItem('pascal-editor-scene')
    return raw ? (JSON.parse(raw) as SceneGraph) : null
  } catch {
    return null
  }
}
