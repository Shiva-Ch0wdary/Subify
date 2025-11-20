import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";

if (process.platform === "win32" && typeof process.setSourceMapsEnabled === "function") {
  // Next.js dev builds produce invalid file:// source map URLs on Windows paths that contain spaces.
  // Turning off Node's automatic source map loading avoids the noisy runtime errors while keeping stack traces readable.
  process.setSourceMapsEnabled(false);
}

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();
const REMOTION_DIR = path.join(ROOT_DIR, "remotion");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const REMOTION_FONTS_DIR = path.dirname(require.resolve("@remotion/google-fonts/package.json"));
const REMOTION_BUNDLER_DIR = path.dirname(require.resolve("@remotion/bundler/package.json"));
const REMOTION_BUNDLER_FAVICON = path.join(REMOTION_BUNDLER_DIR, "favicon.ico");

const REMOTION_NATIVE_PACKAGES = [
  "@remotion/bundler",
  "@remotion/renderer",
  "@remotion/web-renderer",
  "@remotion/media-parser",
  "@remotion/media-utils",
  "@remotion/studio",
  "@remotion/studio-shared",
  "@remotion/compositor-darwin-arm64",
  "@remotion/compositor-darwin-x64",
  "@remotion/compositor-linux-arm64-gnu",
  "@remotion/compositor-linux-arm64-musl",
  "@remotion/compositor-linux-x64-gnu",
  "@remotion/compositor-linux-x64-musl",
  "@remotion/compositor-win32-x64-msvc",
  "@esbuild/win32-x64",
];

const nextConfig: NextConfig = {
  serverExternalPackages: REMOTION_NATIVE_PACKAGES,
  outputFileTracingIncludes: {
    "/api/sessions/[sessionId]/export": [
      REMOTION_DIR,
      PUBLIC_DIR,
      // Remotion bundles import fonts dynamically, so manually trace the package directory.
      REMOTION_FONTS_DIR,
      // Include bundler assets (especially the favicon) to prevent ENOENT errors at runtime.
      REMOTION_BUNDLER_DIR,
      REMOTION_BUNDLER_FAVICON,
    ],
  },
  // Empty turbopack config to acknowledge we're using Turbopack
  turbopack: {},
};

export default nextConfig;
