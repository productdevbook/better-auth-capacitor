import type { App as AppType } from '@capacitor/app'
import type { FocusManager } from 'better-auth/client'
import { kFocusManager } from 'better-auth/client'

type FocusListener = (focused: boolean) => void

// Lazy-loaded App reference
let _App: typeof AppType | null = null

async function getApp(): Promise<typeof AppType> {
  if (!_App) {
    const mod = await import('@capacitor/app')
    _App = mod.App
  }
  return _App
}

class CapacitorFocusManager implements FocusManager {
  listeners = new Set<FocusListener>()
  isFocused: boolean | undefined
  unsubscribe?: () => void

  subscribe(listener: FocusListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setFocused(focused: boolean) {
    // Deduplicate - don't notify if state hasn't changed
    if (this.isFocused === focused)
      return
    this.isFocused = focused
    this.listeners.forEach(listener => listener(focused))
  }

  setup() {
    getApp().then((App) => {
      App.addListener('appStateChange', (state) => {
        this.setFocused(state.isActive)
      }).then((handle) => {
        this.unsubscribe = () => handle.remove()
      }).catch(() => {
        // App plugin not available
      })
    }).catch(() => {
      // Failed to load App module
    })

    return () => {
      this.unsubscribe?.()
    }
  }
}

export function setupCapacitorFocusManager(): FocusManager {
  const global = globalThis as unknown as Record<symbol, FocusManager>
  if (!global[kFocusManager]) {
    global[kFocusManager] = new CapacitorFocusManager()
  }
  return global[kFocusManager]
}
