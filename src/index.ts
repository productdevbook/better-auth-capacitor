import type { BetterAuthPlugin } from '@better-auth/core'
import { createAuthMiddleware } from '@better-auth/core/api'
import { capacitorAuthorizationProxy } from './routes'

export interface CapacitorOptions {
  /**
   * Disable origin override for Capacitor API routes
   * When set to true, the origin header will not be overridden for Capacitor API routes
   */
  disableOriginOverride?: boolean | undefined
}

declare module '@better-auth/core' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    capacitor: {
      creator: typeof capacitor
    }
  }
}

export function capacitor(options?: CapacitorOptions | undefined) {
  return {
    id: 'capacitor',
    init: (_ctx) => {
      const trustedOrigins
        // eslint-disable-next-line node/prefer-global/process
        = process.env.NODE_ENV === 'development'
          ? ['capacitor://', 'ionic://']
          : ['capacitor://', 'ionic://']

      return {
        options: {
          trustedOrigins,
        },
      }
    },
    async onRequest(request, _ctx) {
      if (options?.disableOriginOverride || request.headers.get('origin')) {
        return
      }
      /**
       * To bypass origin check from Capacitor, we need to set the origin
       * header to the capacitor-origin header
       */
      const capacitorOrigin = request.headers.get('capacitor-origin')
      if (!capacitorOrigin) {
        return
      }

      // Construct new Headers with new Request to avoid mutating the original request
      const newHeaders = new Headers(request.headers)
      newHeaders.set('origin', capacitorOrigin)
      const req = new Request(request.url, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        // @ts-expect-error duplex needed for streaming bodies in Node
        duplex: request.body ? 'half' : undefined,
      })

      return {
        request: req,
      }
    },
    hooks: {
      after: [
        {
          matcher(context) {
            return !!(
              context.path?.startsWith('/sign-in/social')
              || context.path?.startsWith('/sign-in/oauth2')
              || context.path?.startsWith('/link-social')
            )
          },
          handler: createAuthMiddleware(async (ctx) => {
            // When request comes from a Capacitor client, disable redirect
            // so better-auth's built-in redirectPlugin doesn't fire window.location.href
            // The capacitor client plugin handles OAuth via ASWebAuthenticationSession/CustomTabs instead
            const capacitorOrigin = ctx.headers?.get('capacitor-origin')
            if (!capacitorOrigin) {
              return
            }

            const returned = ctx.context.returned as { url?: string, redirect?: boolean } | undefined
            if (returned?.url && returned?.redirect) {
              ctx.context.returned = { ...returned, redirect: false }
            }
          }),
        },
        {
          matcher(context) {
            return !!(
              context.path?.startsWith('/callback')
              || context.path?.startsWith('/oauth2/callback')
              || context.path?.startsWith('/magic-link/verify')
              || context.path?.startsWith('/verify-email')
            )
          },
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.context.responseHeaders
            const location = headers?.get('location')
            if (!location) {
              return
            }

            const isProxyURL = location.includes('/oauth-proxy-callback')
            if (isProxyURL) {
              return
            }

            const trustedOrigins = ctx.context.trustedOrigins.filter(
              (origin: string) => !origin.startsWith('http'),
            )
            const isTrustedOrigin = trustedOrigins.some((origin: string) =>
              location?.startsWith(origin),
            )
            if (!isTrustedOrigin) {
              return
            }

            const cookie = headers?.get('set-cookie')
            if (!cookie) {
              return
            }

            const url = new URL(location)
            url.searchParams.set('cookie', cookie)
            ctx.setHeader('location', url.toString())
          }),
        },
      ],
    },
    endpoints: {
      capacitorAuthorizationProxy,
    },
    options,
  } satisfies BetterAuthPlugin
}
