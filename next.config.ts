import type { NextConfig } from "next";
import path from "path";

if (process.platform === "win32" && typeof process.setSourceMapsEnabled === "function") {
  // Next.js dev builds produce invalid file:// source map URLs on Windows paths that contain spaces.
  // Turning off Node's automatic source map loading avoids the noisy runtime errors while keeping stack traces readable.
  process.setSourceMapsEnabled(false);
}

const REMOTION_NATIVE_PACKAGES = [
  "@remotion/bundler",
  "@remotion/renderer",
  "@remotion/web-renderer",
  "@remotion/media-parser",
  "@remotion/media-utils",
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
    "/api/sessions/[sessionId]/export": [path.join(__dirname, "remotion/**/*")],
  },
};

export default nextConfig;
