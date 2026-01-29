# better-auth-capacitor

Better Auth client plugin for Capacitor/Ionic mobile apps. Provides offline-first authentication with persistent storage, OAuth flow support, and session management.

## Features

- **Offline-first authentication** - Sessions are cached in `@capacitor/preferences` for offline access
- **OAuth flow support** - Social login via system browser with deep link callbacks
- **Focus/Online managers** - Automatic session refresh when app regains focus or connectivity
- **Bearer token extraction** - Easy access to auth tokens for API requests
- **Last login method tracking** - Remember which method the user used to sign in

## Installation

```bash
# Using pnpm
pnpm add better-auth-capacitor @capacitor/preferences

# Using npm
npm install better-auth-capacitor @capacitor/preferences

# Using yarn
yarn add better-auth-capacitor @capacitor/preferences
```

### Optional dependencies for OAuth

```bash
pnpm add @capacitor/app @capacitor/browser
```

### Optional dependency for online manager

```bash
pnpm add @capacitor/network
```

## Usage

### Basic Setup

```typescript
import { createAuthClient } from 'better-auth/client'
import { capacitorClient } from 'better-auth-capacitor'

const authClient = createAuthClient({
  baseURL: 'https://api.example.com',
  plugins: [
    capacitorClient({
      scheme: 'myapp', // For OAuth deep links
      storagePrefix: 'better-auth',
    }),
  ],
})
```

### Configuration Options

```typescript
interface CapacitorClientOptions {
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
```

### Getting the Bearer Token

For making authenticated API requests outside of Better Auth:

```typescript
import { getCapacitorAuthToken } from 'better-auth-capacitor'

const token = await getCapacitorAuthToken({
  storagePrefix: 'better-auth',
  cookiePrefix: 'better-auth',
})

if (token) {
  fetch('https://api.example.com/data', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
```

### Last Login Method Plugin

Track which method the user last used to sign in:

```typescript
import { createAuthClient } from 'better-auth/client'
import { capacitorClient, lastLoginMethodClient } from 'better-auth-capacitor'

const authClient = createAuthClient({
  baseURL: 'https://api.example.com',
  plugins: [
    capacitorClient({ scheme: 'myapp' }),
    lastLoginMethodClient({ storagePrefix: 'better-auth' }),
  ],
})

// Get the last used login method
const lastMethod = await authClient.getLastUsedLoginMethod()
// Returns: 'google', 'github', 'email', 'passkey', etc.

// Check if a specific method was last used
const wasGoogle = await authClient.isLastUsedLoginMethod('google')

// Clear the stored method
await authClient.clearLastUsedLoginMethod()
```

### Plugin Actions

The `capacitorClient` plugin adds these actions to your auth client:

```typescript
// Get stored cookie string for manual fetch requests
const cookie = await authClient.getCookie()

// Get cached session data for offline use
const session = await authClient.getCachedSession()

// Clear all stored auth data
await authClient.clearStorage()
```

## OAuth Setup

### 1. Configure Deep Links

#### iOS (Info.plist)

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

#### Android (AndroidManifest.xml)

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="myapp" />
</intent-filter>
```

### 2. Server-side Authorization Proxy

The plugin expects an `/expo-authorization-proxy` endpoint on your server that:
1. Receives the OAuth authorization URL
2. Handles the OAuth callback
3. Redirects back to your app with the session cookie

Example implementation with Better Auth:

```typescript
// server/api/expo-authorization-proxy.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const authorizationURL = query.authorizationURL as string
  const oauthState = query.oauthState as string

  // Redirect to the OAuth provider
  return sendRedirect(event, authorizationURL)
})
```

### 3. Callback URL Configuration

When initiating OAuth sign-in, use relative callback URLs:

```typescript
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/auth/callback', // Will become myapp://auth/callback
})
```

## Platform Detection

```typescript
import { isNativePlatform } from 'better-auth-capacitor'

if (isNativePlatform()) {
  // Running in Capacitor native app
} else {
  // Running in web browser
}
```

## API Reference

### Main Exports

| Export | Description |
|--------|-------------|
| `capacitorClient(options?)` | Main Better Auth plugin for Capacitor |
| `getCapacitorAuthToken(options?)` | Get bearer token from storage |
| `isNativePlatform()` | Check if running in Capacitor native app |
| `setupCapacitorFocusManager()` | Set up app focus tracking |
| `setupCapacitorOnlineManager()` | Set up network connectivity tracking |

### Plugin Exports (`better-auth-capacitor/plugins`)

| Export | Description |
|--------|-------------|
| `lastLoginMethodClient(config?)` | Track last used login method |

### Utility Exports

| Export | Description |
|--------|-------------|
| `normalizeCookieName(name)` | Normalize cookie name for storage |
| `getCookie(cookie)` | Convert stored cookies to header string |
| `getSetCookie(header, prevCookie?)` | Merge new cookies with existing |
| `hasBetterAuthCookies(header, prefix)` | Check if header contains auth cookies |
| `parseSetCookieHeader` | Re-exported from `better-auth/cookies` |

## Requirements

- `better-auth` >= 1.0.0
- `@capacitor/core` >= 6.0.0
- `@capacitor/preferences` >= 6.0.0

### Optional

- `@capacitor/app` >= 6.0.0 (for OAuth deep links, focus manager)
- `@capacitor/browser` >= 6.0.0 (for OAuth browser opening)
- `@capacitor/network` >= 6.0.0 (for online manager)

## License

MIT
