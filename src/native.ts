import { registerPlugin } from '@capacitor/core'

export interface AuthSessionPlugin {
  openAuthSession(options: {
    url: string
    redirectScheme: string
  }): Promise<{ url: string }>
}

export const AuthSession = registerPlugin<AuthSessionPlugin>('BetterAuthCapacitor')
