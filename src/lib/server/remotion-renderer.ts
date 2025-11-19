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

// Disable Remotion Studio (not needed for server-side rendering)
if (!process.env.REMOTION_STUDIO_ENABLED) {
  process.env.REMOTION_STUDIO_ENABLED = "false";
}
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
  plugins?: unknown[];
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
  };
  config.resolve.extensions = Array.from(
    new Set([...(config.resolve.extensions ?? []), ".ts", ".tsx", ".js", ".jsx", ".mjs"]),
  );
  
  // Add plugin to ignore @remotion/studio (dev-only dependency not needed for rendering)
  config.plugins = config.plugins || [];
  
  // Create an IgnorePlugin to exclude @remotion/studio modules
  // This avoids issues in serverless environments where studio files don't exist
  const ignorePlugin = {
    apply(compiler: { hooks?: { normalModuleFactory?: { tap?: (name: string, handler: (nmf: unknown) => void) => void } } }) {
      if (compiler?.hooks?.normalModuleFactory?.tap) {
        compiler.hooks.normalModuleFactory.tap("IgnoreStudioPlugin", (nmf: unknown) => {
          const nmfHooks = nmf as { hooks?: { beforeResolve?: { tap?: (name: string, handler: (resolveData: { request?: string }) => unknown) => void } } };
          if (nmfHooks?.hooks?.beforeResolve?.tap) {
            nmfHooks.hooks.beforeResolve.tap("IgnoreStudioPlugin", (resolveData: { request?: string }) => {
              if (resolveData?.request?.includes("@remotion/studio")) {
                return false;
              }
            });
          }
        });
      }
    },
  };
  
  config.plugins.push(ignorePlugin);
  
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

        // Ensure public directory exists to prevent bundler errors
        const fs = await import("fs");
        if (!fs.existsSync(PUBLIC_DIR)) {
          fs.mkdirSync(PUBLIC_DIR, { recursive: true });
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
