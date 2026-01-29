import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/plugins/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    'better-auth',
    'better-auth/client',
    'better-auth/cookies',
    '@capacitor/core',
    '@capacitor/preferences',
    '@capacitor/app',
    '@capacitor/browser',
    '@capacitor/network',
  ],
})
