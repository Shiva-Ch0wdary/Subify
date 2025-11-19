import "server-only";

import os from "os";
import path from "path";
import type { CaptionCompositionProps } from "@/lib/types/captions";

const ROOT_DIR = process.cwd();
const REMOTION_DIR = path.join(ROOT_DIR, "remotion");
const REMOTION_ENTRY = path.join(REMOTION_DIR, "Root.tsx");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SRC_DIR = path.join(ROOT_DIR, "src");
const REMOTION_CACHE_DIR = path.join(os.tmpdir(), "remotion-cache");

if (!process.env.REMOTION_DISABLE_CACHE) {
  process.env.REMOTION_DISABLE_CACHE = "true";
}
if (!process.env.REMOTION_CACHE_LOCATION) {
  process.env.REMOTION_CACHE_LOCATION = REMOTION_CACHE_DIR;
}

type RendererModule = typeof import("@remotion/renderer");
type BundlerModule = typeof import("@remotion/bundler");

type MutableWebpackConfig = {
  resolve?: {
    alias?: Record<string, string>;
    extensions?: string[];
    [key: string]: unknown;
  };
  externals?: unknown[];
  [key: string]: unknown;
};

type RemotionModules = {
  bundle: BundlerModule["bundle"];
  renderMedia: RendererModule["renderMedia"];
  selectComposition: RendererModule["selectComposition"];
};

let remotionModulesPromise: Promise<RemotionModules> | null = null;
let serveUrlPromise: Promise<string> | null = null;

const loadRemotionModules = () => {
  if (!remotionModulesPromise) {
    remotionModulesPromise = (async () => {
      const [{ bundle }, renderer] = await Promise.all([
        import("@remotion/bundler"),
        import("@remotion/renderer"),
      ]);
      const { renderMedia, selectComposition } = renderer;
      return { bundle, renderMedia, selectComposition };
    })().catch((error) => {
      remotionModulesPromise = null;
      throw error;
    });
  }
  return remotionModulesPromise;
};

const applyWebpackAlias = (config: MutableWebpackConfig) => {
  config.resolve ??= {};
  config.resolve.alias = {
    ...(config.resolve.alias ?? {}),
    "@": SRC_DIR,
    // Prevent @remotion/studio from being bundled (it's dev-only)
    "@remotion/studio": false as unknown as string,
    "@remotion/studio-shared": false as unknown as string,
  };
  config.resolve.extensions = Array.from(
    new Set([...(config.resolve.extensions ?? []), ".ts", ".tsx", ".js", ".jsx", ".mjs"]),
  );
  return config;
};

const bundleRemotionProject = async () => {
  if (!serveUrlPromise) {
    serveUrlPromise = loadRemotionModules()
      .then(async ({ bundle }) => {
        // Preload fonts before bundling to ensure they're available
        try {
          const { ensureCaptionFonts } = await import("../../../remotion/fonts");
          await ensureCaptionFonts();
        } catch (error) {
          console.warn("[remotion] Font preload failed, continuing with fallback", error);
        }

        // The bundler typings still expect the legacy positional arguments signature.
        // Cast to `any` so we can use the modern options object without type noise.
        return (bundle as unknown as (options: Record<string, unknown>) => Promise<string>)({
          entryPoint: REMOTION_ENTRY,
          publicDir: PUBLIC_DIR,
          webpackOverride: applyWebpackAlias,
          enableCaching: false,
          cacheDir: REMOTION_CACHE_DIR,
        });
      })
      .catch((error) => {
        serveUrlPromise = null;
        throw error;
      });
  }

  return serveUrlPromise;
};

export const renderCaptionVideo = async (
  props: CaptionCompositionProps,
  outputLocation: string,
) => {
  const [modules, serveUrl] = await Promise.all([
    loadRemotionModules(),
    bundleRemotionProject(),
  ]);

  const composition = await modules.selectComposition({
    serveUrl,
    id: "CaptionComposition",
    inputProps: props,
  });

  await modules.renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    audioCodec: "aac",
    outputLocation,
    inputProps: props,
    overwrite: true,
    onProgress: (progress) => {
      if (process.env.NODE_ENV !== "production") {
        const percentage = (progress.progress * 100).toFixed(1);
        console.log(`[remotion][render] ${percentage}% complete`);
      }
    },
  });
};
