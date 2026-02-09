import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/plugins/index.ts', 'src/native.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    '@better-auth/core',
    '@better-auth/core/api',
    'better-auth',
    'better-auth/api',
    'better-auth/client',
    'better-auth/cookies',
    'zod',
    '@capacitor/core',
    '@capacitor/preferences',
    '@capacitor/app',
    '@capacitor/network',
  ],
})
