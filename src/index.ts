export {
  capacitorClient,
  clearCapacitorAuthToken,
  getCapacitorAuthToken,
  getCookie,
  getSetCookie,
  hasBetterAuthCookies,
  isNativePlatform,
  normalizeCookieName,
  parseSetCookieHeader,
  setCapacitorAuthToken,
} from './client'

export type {
  CapacitorClientOptions,
  GetCapacitorAuthTokenOptions,
  SetCapacitorAuthTokenOptions,
} from './client'

export { setupCapacitorFocusManager } from './focus-manager'
export { setupCapacitorOnlineManager } from './online-manager'

// Plugins
export { lastLoginMethodClient } from './plugins/last-login-method'
export type { LastLoginMethodClientConfig } from './plugins/last-login-method'
