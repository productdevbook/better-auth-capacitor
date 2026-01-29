export {
  capacitorClient,
  getCapacitorAuthToken,
  getCookie,
  getSetCookie,
  hasBetterAuthCookies,
  isNativePlatform,
  normalizeCookieName,
  parseSetCookieHeader,
} from './client'

export type {
  CapacitorClientOptions,
  GetCapacitorAuthTokenOptions,
} from './client'

export { setupCapacitorFocusManager } from './focus-manager'
export { setupCapacitorOnlineManager } from './online-manager'

// Plugins
export { lastLoginMethodClient } from './plugins/last-login-method'
export type { LastLoginMethodClientConfig } from './plugins/last-login-method'
