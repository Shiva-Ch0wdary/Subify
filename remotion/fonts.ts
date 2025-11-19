import { loadFont as loadNotoSans } from "@remotion/google-fonts/NotoSans";
import { loadFont as loadNotoSansDevanagari } from "@remotion/google-fonts/NotoSansDevanagari";

const CAPTION_FONT_WEIGHTS = ["600", "700"] as const;
const DEVANAGARI_FONT_WEIGHTS = ["600"] as const;

const notoSans = loadNotoSans("normal", {
  weights: CAPTION_FONT_WEIGHTS.map((weight) => weight),
  subsets: ["latin", "latin-ext"],
  ignoreTooManyRequestsWarning: true,
});

const notoSansDevanagari = loadNotoSansDevanagari("normal", {
  weights: DEVANAGARI_FONT_WEIGHTS.map((weight) => weight),
  subsets: ["devanagari"],
  ignoreTooManyRequestsWarning: true,
});

let ensurePromise: Promise<void> | null = null;

export const ensureCaptionFonts = () => {
  if (!ensurePromise) {
    ensurePromise = Promise.all([
      notoSans.waitUntilDone(),
      notoSansDevanagari.waitUntilDone(),
    ]).then(() => undefined);
  }
  return ensurePromise;
};

export const CAPTION_FONT_STACK = `"${notoSans.fontFamily}", "${notoSansDevanagari.fontFamily}", sans-serif`;

ensureCaptionFonts();
