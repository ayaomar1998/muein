// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Force Nitro on (the lovable config skips it outside its sandbox) and pick the
  // deploy target via NITRO_PRESET. Defaults to `netlify` so `npm run build`
  // on Netlify produces a Netlify Function for SSR instead of a Cloudflare Worker.
  nitro: {
    preset: process.env.NITRO_PRESET ?? "netlify",
    // Override the lovable defaults that hardcode `dist/server`. Netlify only
    // auto-detects SSR functions when they're inside `.netlify/functions-internal/`
    // (or `netlify/functions/`). Putting the bundle in dist/server makes Netlify
    // skip it and the site falls back to 404 on every route.
    output: {
      dir: ".",
      serverDir: ".netlify/functions-internal/server",
      publicDir: "dist/client",
    },
  },
});
