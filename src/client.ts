import type { BetterAuthClientPlugin, ClientStore } from 'better-auth'
import {
  parseSetCookieHeader,
  SECURE_COOKIE_PREFIX,
  stripSecureCookiePrefix,
} from 'better-auth/cookies'

/**
 * Safe JSON parse utility
 * Returns null if parsing fails
 */
function safeJSONParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T
  }
  catch {
    return null
  }
}

// Lazy-loaded module references (cached to avoid re-importing)
let _PreferencesMod: typeof import('@capacitor/preferences') | null = null
let _BrowserMod: typeof import('@capacitor/browser') | null = null
let _AppMod: typeof import('@capacitor/app') | null = null

async function getPreferencesMod() {
  if (!_PreferencesMod) {
    _PreferencesMod = await import('@capacitor/preferences')
  }
  return _PreferencesMod
}

async function getBrowserMod() {
  if (!_BrowserMod) {
    _BrowserMod = await import('@capacitor/browser')
  }
  return _BrowserMod
}

async function getAppMod() {
  if (!_AppMod) {
    _AppMod = await import('@capacitor/app')
  }
  return _AppMod
}

/**
 * Synchronous platform check using window.Capacitor global
 * Safe to call at build time (returns false when window is undefined)
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined')
    return false
  const win = window as { Capacitor?: { isNativePlatform?: () => boolean } }
  return win.Capacitor?.isNativePlatform?.() ?? false
}

export interface GetCapacitorAuthTokenOptions {
  /**
   * Prefix for storage keys
   * @default 'better-auth'
   */
  storagePrefix?: string
  /**
   * Cookie prefix used by better-auth
   * @default 'better-auth'
   */
  cookiePrefix?: string
}

export interface SetCapacitorAuthTokenOptions {
  /**
   * The session token to store
   */
  token: string
  /**
   * Token expiration date (ISO string or Date)
   * @default 7 days from now
   */
  expiresAt?: string | Date
  /**
   * Prefix for storage keys
   * @default 'better-auth'
   */
  storagePrefix?: string
  /**
   * Cookie prefix used by better-auth
   * @default 'better-auth'
   */
  cookiePrefix?: string
}

/**
 * Store a session token in Capacitor Preferences storage
 * Useful for custom auth endpoints that bypass the Better Auth client
 *
 * @example
 * ```ts
 * // After custom login endpoint
 * const response = await fetch('/api/auth/custom-login', { ... })
 * const data = await response.json()
 *
 * await setCapacitorAuthToken({
 *   token: data.session.token,
 *   expiresAt: data.session.expiresAt,
 *   storagePrefix: 'my-app',
 * })
 * ```
 */
export async function setCapacitorAuthToken(opts: SetCapacitorAuthTokenOptions): Promise<boolean> {
  if (!isNativePlatform())
    return false

  const { token, storagePrefix = 'better-auth', cookiePrefix = 'better-auth' } = opts
  const cookieName = `${storagePrefix}_cookie`

  // Calculate expiry
  const expiresAt = opts.expiresAt
    ? (opts.expiresAt instanceof Date ? opts.expiresAt.toISOString() : opts.expiresAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default: 7 days

  try {
    const { Preferences } = await getPreferencesMod()
    const normalizedCookieName = normalizeCookieName(cookieName)

    // Get existing cookies
    const existingCookie = (await Preferences.get({ key: normalizedCookieName }))?.value
    let cookieData: Record<string, StoredCookie> = {}

    if (existingCookie) {
      try {
        cookieData = JSON.parse(existingCookie)
      }
      catch {
        // Invalid JSON, start fresh
      }
    }

    // Store token with both regular and secure prefixed names
    // This ensures compatibility regardless of server's useSecureCookies setting
    const baseCookieName = `${cookiePrefix}.session_token`
    const secureCookieName = `${SECURE_COOKIE_PREFIX}${baseCookieName}`

    cookieData[baseCookieName] = { value: token, expires: expiresAt }
    cookieData[secureCookieName] = { value: token, expires: expiresAt }

    await Preferences.set({
      key: normalizedCookieName,
      value: JSON.stringify(cookieData),
    })

    return true
  }
  catch {
    return false
  }
}

/**
 * Clear the stored session token from Capacitor Preferences
 * Useful for custom logout flows
 */
export async function clearCapacitorAuthToken(opts?: Pick<SetCapacitorAuthTokenOptions, 'storagePrefix'>): Promise<boolean> {
  if (!isNativePlatform())
    return false

  const storagePrefix = opts?.storagePrefix || 'better-auth'
  const cookieName = `${storagePrefix}_cookie`
  const localCacheName = `${storagePrefix}_session_data`

  try {
    const { Preferences } = await getPreferencesMod()
    await Preferences.remove({ key: normalizeCookieName(cookieName) })
    await Preferences.remove({ key: normalizeCookieName(localCacheName) })
    return true
  }
  catch {
    return false
  }
}

/**
 * Get the bearer token from Capacitor Preferences storage
 * Useful for adding Authorization header to fetch requests in native apps
 * @returns The bearer token or null if not found/not native
 */
export async function getCapacitorAuthToken(opts?: GetCapacitorAuthTokenOptions): Promise<string | null> {
  if (!isNativePlatform())
    return null

  const storagePrefix = opts?.storagePrefix || 'better-auth'
  const cookiePrefix = opts?.cookiePrefix || 'better-auth'
  const cookieName = `${storagePrefix}_cookie`

  try {
    const { Preferences } = await getPreferencesMod()
    const storedCookie = (await Preferences.get({ key: normalizeCookieName(cookieName) }))?.value

    if (!storedCookie)
      return null

    const cookieData = JSON.parse(storedCookie) as Record<string, StoredCookie>
    // Try secure prefix first, then regular
    const tokenKey = cookieData[`${SECURE_COOKIE_PREFIX}${cookiePrefix}.session_token`]
      ? `${SECURE_COOKIE_PREFIX}${cookiePrefix}.session_token`
      : `${cookiePrefix}.session_token`

    return cookieData[tokenKey]?.value || null
  }
  catch {
    return null
  }
}

// Lazy initialization for managers - must be runtime, not build time
let managersInitialized = false
async function initializeManagers() {
  if (managersInitialized || !isNativePlatform())
    return
  managersInitialized = true

  // Dynamic import managers to avoid build-time evaluation
  const [{ setupCapacitorFocusManager }, { setupCapacitorOnlineManager }] = await Promise.all([
    import('./focus-manager'),
    import('./online-manager'),
  ])

  setupCapacitorFocusManager()
  setupCapacitorOnlineManager()
}

interface StoredCookie {
  value: string
  expires: string | null
}

export interface CapacitorClientOptions {
  /**
   * Prefix for storage keys
   * @default 'better-auth'
   */
  storagePrefix?: string
  /**
   * Prefix(es) for server cookie names to filter
   * Prevents infinite refetching when third-party cookies are set
   * @default 'better-auth'
   */
  cookiePrefix?: string | string[]
  /**
   * App scheme for deep links (e.g., 'myapp')
   * Used for OAuth callback URLs
   */
  scheme?: string
  /**
   * Disable session caching
   * @default false
   */
  disableCache?: boolean
}

/**
 * Normalize cookie name for storage compatibility
 * Replaces colons with underscores (fixes secure store issues)
 * @see https://github.com/better-auth/better-auth/issues/5426
 */
export function normalizeCookieName(name: string): string {
  return name.replace(/:/g, '_')
}

/**
 * Merge new cookies with existing ones
 */
export function getSetCookie(header: string, prevCookie?: string): string {
  const parsed = parseSetCookieHeader(header)
  let toSetCookie: Record<string, StoredCookie> = {}

  parsed.forEach((cookie, key) => {
    const expiresAt = cookie.expires
    const maxAge = cookie['max-age']
    const expires = maxAge
      ? new Date(Date.now() + Number(maxAge) * 1000)
      : expiresAt
        ? new Date(String(expiresAt))
        : null

    toSetCookie[key] = {
      value: cookie.value,
      expires: expires ? expires.toISOString() : null,
    }
  })

  if (prevCookie) {
    try {
      const prevCookieParsed = JSON.parse(prevCookie)
      toSetCookie = {
        ...prevCookieParsed,
        ...toSetCookie,
      }
    }
    catch {
      // Invalid JSON, ignore
    }
  }

  return JSON.stringify(toSetCookie)
}

/**
 * Convert stored cookies to cookie header string
 */
export function getCookie(cookie: string): string {
  let parsed: Record<string, StoredCookie> = {}

  try {
    parsed = JSON.parse(cookie) as Record<string, StoredCookie>
  }
  catch {
    return ''
  }

  const validCookies = Object.entries(parsed)
    .filter(([, value]) => !value.expires || new Date(value.expires) >= new Date())
    .map(([key, value]) => `${key}=${value.value}`)

  return validCookies.join('; ')
}

/**
 * Check if Set-Cookie header contains better-auth cookies
 * Prevents infinite refetching when third-party cookies (like Cloudflare __cf_bm) are present
 */
export function hasBetterAuthCookies(setCookieHeader: string, cookiePrefix: string | string[]): boolean {
  const cookies = parseSetCookieHeader(setCookieHeader)
  const cookieSuffixes = ['session_token', 'session_data']
  const prefixes = Array.isArray(cookiePrefix) ? cookiePrefix : [cookiePrefix]

  for (const name of cookies.keys()) {
    // Remove __Secure- prefix if present using official utility
    const nameWithoutSecure = stripSecureCookiePrefix(name)

    for (const prefix of prefixes) {
      if (prefix) {
        // Check if cookie starts with the prefix
        if (nameWithoutSecure.startsWith(prefix))
          return true
      }
      else {
        // When prefix is empty, check for common better-auth cookie patterns
        for (const suffix of cookieSuffixes) {
          if (nameWithoutSecure.endsWith(suffix))
            return true
        }
      }
    }
  }
  return false
}

/**
 * Check if session cookies have changed (ignore expiry)
 */
function hasSessionCookieChanged(prevCookie: string | null, newCookie: string): boolean {
  if (!prevCookie)
    return true

  try {
    const prev = JSON.parse(prevCookie) as Record<string, StoredCookie>
    const next = JSON.parse(newCookie) as Record<string, StoredCookie>

    const sessionKeys = new Set<string>()
    Object.keys(prev).forEach((key) => {
      if (key.includes('session_token') || key.includes('session_data'))
        sessionKeys.add(key)
    })
    Object.keys(next).forEach((key) => {
      if (key.includes('session_token') || key.includes('session_data'))
        sessionKeys.add(key)
    })

    for (const key of sessionKeys) {
      const prevValue = prev[key]?.value
      const nextValue = next[key]?.value
      if (prevValue !== nextValue) {
        return true
      }
    }

    return false
  }
  catch {
    return true
  }
}

/**
 * Get OAuth state value from stored cookies
 * Supports both secure-prefixed and unprefixed cookie naming conventions
 */
function getOAuthStateValue(
  cookieJson: string | null,
  cookiePrefix: string | string[],
): string | null {
  if (!cookieJson)
    return null

  const parsed = safeJSONParse<Record<string, StoredCookie>>(cookieJson)
  if (!parsed)
    return null

  const prefixes = Array.isArray(cookiePrefix) ? cookiePrefix : [cookiePrefix]

  for (const prefix of prefixes) {
    // cookie strategy uses: <prefix>.oauth_state
    const candidates = [
      `${SECURE_COOKIE_PREFIX}${prefix}.oauth_state`,
      `${prefix}.oauth_state`,
    ]

    for (const name of candidates) {
      const value = parsed?.[name]?.value
      if (value)
        return value
    }
  }

  return null
}

/**
 * Get the origin URL for the app scheme
 */
function getOrigin(scheme: string): string {
  return `${scheme}://`
}

/**
 * Capacitor client plugin for Better Auth
 * Provides offline-first authentication with persistent storage
 */
export function capacitorClient(opts?: CapacitorClientOptions): BetterAuthClientPlugin {
  let store: ClientStore | null = null
  const storagePrefix = opts?.storagePrefix || 'better-auth'
  const cookiePrefix = opts?.cookiePrefix || 'better-auth'
  const cookieName = `${storagePrefix}_cookie`
  const localCacheName = `${storagePrefix}_session_data`
  const scheme = opts?.scheme

  return {
    id: 'capacitor',

    getActions: (_$fetch: unknown, $store: ClientStore) => {
      store = $store
      return {
        /**
         * Get stored cookie string for manual fetch requests
         */
        getCookie: async () => {
          const { Preferences } = await getPreferencesMod()
          const result = await Preferences.get({ key: normalizeCookieName(cookieName) })
          return getCookie(result?.value || '{}')
        },

        /**
         * Get cached session data for offline use
         */
        getCachedSession: async () => {
          const { Preferences } = await getPreferencesMod()
          const result = await Preferences.get({ key: normalizeCookieName(localCacheName) })
          if (!result?.value)
            return null
          try {
            return JSON.parse(result.value)
          }
          catch {
            return null
          }
        },

        /**
         * Clear all stored auth data
         */
        clearStorage: async () => {
          const { Preferences } = await getPreferencesMod()
          await Preferences.remove({ key: normalizeCookieName(cookieName) })
          await Preferences.remove({ key: normalizeCookieName(localCacheName) })
        },
      }
    },

    fetchPlugins: [
      {
        id: 'capacitor',
        name: 'Capacitor Auth',
        hooks: {
          async onSuccess(context: { response: Response, data: Record<string, unknown>, request: { url: string | URL, body: string, baseURL?: string } }) {
            if (!isNativePlatform())
              return

            const { Preferences } = await getPreferencesMod()
            const normalizedCookieName = normalizeCookieName(cookieName)

            // Handle set-auth-token header (Better Auth's token response)
            const authToken = context.response.headers.get('set-auth-token')
            if (authToken) {
              const prefixStr = Array.isArray(cookiePrefix) ? cookiePrefix[0] : cookiePrefix
              const prevCookie = (await Preferences.get({ key: normalizedCookieName }))?.value

              // Store token with BOTH prefixed and non-prefixed names
              // This ensures compatibility regardless of server's useSecureCookies setting
              // Server will find whichever cookie name it's looking for
              const baseCookieName = `${prefixStr}.session_token`
              const secureCookieName = `${SECURE_COOKIE_PREFIX}${baseCookieName}`

              // Create cookie header with both versions
              const tokenCookies = `${baseCookieName}=${authToken}, ${secureCookieName}=${authToken}`
              const newCookie = getSetCookie(tokenCookies, prevCookie ?? undefined)

              if (hasSessionCookieChanged(prevCookie ?? null, newCookie)) {
                await Preferences.set({ key: normalizedCookieName, value: newCookie })
                store?.notify('$sessionSignal')
              }
              else {
                // Still update to refresh expiry
                await Preferences.set({ key: normalizedCookieName, value: newCookie })
              }
            }

            // Handle standard Set-Cookie header
            const setCookie = context.response.headers.get('set-cookie')
            if (setCookie) {
              // Only process if it contains better-auth cookies
              // This prevents infinite refetching when third-party cookies are present
              if (hasBetterAuthCookies(setCookie, cookiePrefix)) {
                const prevCookie = (await Preferences.get({ key: normalizedCookieName }))?.value
                const toSetCookie = getSetCookie(setCookie, prevCookie ?? undefined)

                if (hasSessionCookieChanged(prevCookie ?? null, toSetCookie)) {
                  await Preferences.set({ key: normalizedCookieName, value: toSetCookie })
                  store?.notify('$sessionSignal')
                }
                else {
                  // Still update the storage to refresh expiry times, but don't trigger refetch
                  await Preferences.set({ key: normalizedCookieName, value: toSetCookie })
                }
              }
            }

            // Cache session data for offline use
            if (
              context.request.url.toString().includes('/get-session')
              && !opts?.disableCache
            ) {
              const data = context.data
              await Preferences.set({
                key: normalizeCookieName(localCacheName),
                value: JSON.stringify(data),
              })
            }

            // Handle OAuth redirect for social sign-in
            if (
              context.data?.redirect
              && (context.request.url.toString().includes('/sign-in')
                || context.request.url.toString().includes('/link-social'))
              && !context.request?.body?.includes?.('idToken') // idToken is for silent sign-in
              && scheme
            ) {
              const [{ Browser }, { App }] = await Promise.all([getBrowserMod(), getAppMod()])

              const callbackURL = JSON.parse(context.request.body)?.callbackURL
              const signInURL = context.data?.url as string

              const storedCookieJson = (await Preferences.get({ key: normalizedCookieName }))?.value
              const oauthStateValue = getOAuthStateValue(storedCookieJson ?? null, cookiePrefix)

              const params = new URLSearchParams({ authorizationURL: signInURL })
              if (oauthStateValue) {
                params.append('oauthState', oauthStateValue)
              }

              const proxyURL = `${context.request.baseURL}/capacitor-authorization-proxy?${params.toString()}`

              // Open browser for OAuth
              await Browser.open({ url: proxyURL })

              // Listen for deep link callback
              const handle = await App.addListener('appUrlOpen', async ({ url }) => {
                try {
                  const urlObj = new URL(url)
                  const cookie = urlObj.searchParams.get('cookie')
                  if (cookie) {
                    const prevCookie = (await Preferences.get({ key: normalizedCookieName }))?.value
                    const toSetCookie = getSetCookie(cookie, prevCookie ?? undefined)
                    await Preferences.set({ key: normalizedCookieName, value: toSetCookie })
                    store?.notify('$sessionSignal')
                  }

                  // Check if callback matches expected URL
                  const cleanUrl = url.split('?')[0]
                  if (callbackURL && (urlObj.pathname === callbackURL || cleanUrl === callbackURL)) {
                    // Close browser
                    try {
                      await Browser.close()
                    }
                    catch {
                      // Browser may already be closed
                    }
                    handle.remove()
                  }
                }
                catch {
                  // Invalid URL, ignore
                }
              })
            }
          },
        },

        async init(url: string, options?: RequestInit & { body?: Record<string, string> }) {
          if (!isNativePlatform()) {
            return { url, options }
          }
          await initializeManagers()

          const { Preferences } = await getPreferencesMod()
          const normalizedCookieName = normalizeCookieName(cookieName)

          // Add stored cookie to request headers
          const storedCookie = (await Preferences.get({ key: normalizedCookieName }))?.value

          // Extract bearer token from stored cookies
          let bearerToken: string | null = null
          try {
            const cookieData = JSON.parse(storedCookie || '{}') as Record<string, StoredCookie>
            // Try secure prefix first, then regular
            const prefixStr = Array.isArray(cookiePrefix) ? cookiePrefix[0] : cookiePrefix
            const tokenKey = cookieData[`${SECURE_COOKIE_PREFIX}${prefixStr}.session_token`]
              ? `${SECURE_COOKIE_PREFIX}${prefixStr}.session_token`
              : `${prefixStr}.session_token`
            bearerToken = cookieData[tokenKey]?.value || null
          }
          catch {
            // Invalid JSON, ignore
          }

          options = options || {}
          options.credentials = 'omit'
          // Cookie header is forbidden in fetch, use Authorization instead
          options.headers = {
            ...options.headers,
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          }

          // Add Capacitor-specific headers when scheme is configured
          if (scheme) {
            options.headers = {
              ...options.headers,
              'capacitor-origin': getOrigin(scheme),
              'x-skip-oauth-proxy': 'true',
            }

            // Rewrite relative callback URLs to deep link URLs
            if (options.body?.callbackURL) {
              if (options.body.callbackURL.startsWith('/')) {
                options.body.callbackURL = `${scheme}:/${options.body.callbackURL}`
              }
            }
            if (options.body?.newUserCallbackURL) {
              if (options.body.newUserCallbackURL.startsWith('/')) {
                options.body.newUserCallbackURL = `${scheme}:/${options.body.newUserCallbackURL}`
              }
            }
            if (options.body?.errorCallbackURL) {
              if (options.body.errorCallbackURL.startsWith('/')) {
                options.body.errorCallbackURL = `${scheme}:/${options.body.errorCallbackURL}`
              }
            }
          }

          // Handle sign-out: clear storage and update state immediately
          if (url.includes('/sign-out')) {
            await Preferences.set({ key: normalizedCookieName, value: '{}' })
            store?.atoms?.session?.set({
              ...store.atoms.session.get(),
              data: null,
              error: null,
              isPending: false,
            })
            await Preferences.set({ key: normalizeCookieName(localCacheName), value: '{}' })
          }

          return { url, options }
        },
      },
    ],
  }
}

export * from './focus-manager'
export * from './online-manager'
export { parseSetCookieHeader } from 'better-auth/cookies'
