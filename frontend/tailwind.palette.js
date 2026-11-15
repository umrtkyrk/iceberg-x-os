/**
 * Theme-aware Tailwind palette.
 *
 * The portal uses ~3,000 hard-coded colour utilities (`bg-white`, `text-gray-900`,
 * `border-gray-100`, `bg-emerald-50`, ...). Instead of adding a `dark:` twin to
 * every one of them, the colours that only make sense on a light surface are
 * routed through CSS custom properties:
 *
 *   - In light mode every variable holds Tailwind's own value, so the light
 *     theme renders exactly as before.
 *   - Under `html.dark` the variables switch to a dark palette.
 *   - Inside `.theme-fixed` the original values are restored for that subtree:
 *     certificates and print sheets, or sections that were designed dark.
 *
 * Colours are mapped per utility, because the same name means different things:
 * `bg-white` is a card surface and must go dark, while `text-white` sits on a
 * magenta button and must stay white. Translucent whites such as `bg-white/10`
 * or `border-white/10` are glass effects on dark panels and stay literal.
 *
 * New code gets dark mode for free by using the ordinary Tailwind classes; use
 * `dark:` only for the rare case the mapping gets wrong.
 */
import defaultColors from 'tailwindcss/colors';

// --- Brand colours (shared with tailwind.config.js) ------------------------
export const brandColors = {
  magenta: {
    DEFAULT: '#e6007e',
    hover: '#ff4da6',
    light: '#ff99cc',
    100: '#fdf2f8',
    200: '#fce7f3',
    600: '#db2777',
    700: '#be185d',
  },
  ice: {
    light: '#f0f9ff',
    DEFAULT: '#e0f2fe',
    dark: '#bae6fd',
  },
  dark: {
    DEFAULT: '#111111',
    card: '#1a1a1a',
    bg: '#161618',
  },
  grey: {
    bg: '#f6f6f8',
    text: '#6b7280',
    border: 'rgba(17, 17, 17, 0.06)',
  },
};

// --- Dark palette -----------------------------------------------------------
export const DARK = {
  page: '#0c0e12',
  card: '#15181e',
};

const NEUTRALS = ['gray', 'slate', 'zinc', 'neutral', 'stone'];
const TINTS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

/** Neutral backgrounds: light shades become stepped dark surfaces; the dark
 *  shades are lifted a little so dark buttons and panels still read against a
 *  dark card. 500/600 are mid-tones and keep their value. */
const NEUTRAL_BG = {
  50: '#1a1d24',
  100: '#20242c',
  200: '#2a2f38',
  300: '#363c47',
  400: '#4a515e',
  700: '#3d4452',
  800: '#303643',
  900: '#232833',
  950: '#1b1f27',
};
/** Neutral text: dark inks become light inks. 50-300 are already used for text
 *  on dark panels and keep their value. */
const NEUTRAL_TEXT = {
  400: '#8a919d',
  500: '#a0a7b2',
  600: '#b8bec7',
  700: '#cfd3da',
  800: '#e1e4e9',
  900: '#eef0f3',
  950: '#f6f7f9',
};
const NEUTRAL_BORDER = {
  50: '#1c1f26',
  100: '#23272f',
  200: '#2d323b',
  300: '#3a404b',
  400: '#4b5260',
  700: '#454c5a',
  800: '#383e4a',
  900: '#2a2f39',
};

// --- Helpers ----------------------------------------------------------------
const toRgb = hex => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
};
const channels = hex => toRgb(hex).join(' ');
/** `weight` of `hex` over `base`, both opaque: a tint that sits on a dark card. */
const mix = (hex, base, weight) => {
  const a = toRgb(hex);
  const b = toRgb(base);
  return '#' + a.map((c, i) => Math.round(c * weight + b[i] * (1 - weight)).toString(16).padStart(2, '0')).join('');
};

/** name -> { light, dark } for every variable the palette defines. */
const tokens = {};

/**
 * A Tailwind colour backed by `--ix-<name>`.
 * `literalBelow`: explicit opacities under this value (`bg-white/10`) keep the
 * literal light colour instead of the themed one.
 */
const themed = (name, light, dark, { literalBelow } = {}) => {
  tokens[name] = { light: channels(light), dark: channels(dark) };
  const literal = channels(light);
  return ({ opacityValue } = {}) => {
    if (opacityValue === undefined) return `rgb(var(--ix-${name}))`;
    if (literalBelow !== undefined) {
      const numeric = Number(opacityValue);
      if (!Number.isNaN(numeric) && numeric < literalBelow) return `rgb(${literal} / ${opacityValue})`;
    }
    return `rgb(var(--ix-${name}) / ${opacityValue})`;
  };
};

const scale = (prefix, family, shades, { literalBelow } = {}) =>
  Object.fromEntries(
    Object.entries(shades).map(([shade, dark]) => [
      shade,
      themed(`${prefix}-${family}-${shade}`, defaultColors[family][shade], dark, {
        literalBelow: Number(shade) >= 700 ? literalBelow : undefined,
      }),
    ])
  );

// --- Per-utility palettes ---------------------------------------------------
const backgroundColor = {
  white: themed('bg-white', '#ffffff', DARK.card, { literalBelow: 0.5 }),
  // The app canvas. `bg-slate-50` in light mode, the darkest layer in dark mode.
  page: themed('bg-page', defaultColors.slate[50], DARK.page),
  magenta: {
    100: themed('bg-magenta-100', brandColors.magenta[100], mix(brandColors.magenta.DEFAULT, DARK.card, 0.14)),
    200: themed('bg-magenta-200', brandColors.magenta[200], mix(brandColors.magenta.DEFAULT, DARK.card, 0.22)),
  },
  ice: {
    light: themed('bg-ice-light', brandColors.ice.light, mix(defaultColors.sky[500], DARK.card, 0.08)),
    DEFAULT: themed('bg-ice', brandColors.ice.DEFAULT, mix(defaultColors.sky[500], DARK.card, 0.14)),
    dark: themed('bg-ice-dark', brandColors.ice.dark, mix(defaultColors.sky[500], DARK.card, 0.24)),
  },
  grey: {
    bg: themed('bg-grey-bg', brandColors.grey.bg, NEUTRAL_BG[50]),
  },
};
const textColor = {
  dark: { DEFAULT: themed('text-dark', brandColors.dark.DEFAULT, NEUTRAL_TEXT[900]) },
  grey: { text: themed('text-grey-text', brandColors.grey.text, NEUTRAL_TEXT[500]) },
  magenta: {
    // #e6007e on a dark card is below 4.5:1; the brand's own hover pink is not.
    DEFAULT: themed('text-magenta', brandColors.magenta.DEFAULT, brandColors.magenta.hover),
    600: themed('text-magenta-600', brandColors.magenta[600], brandColors.magenta.hover),
    700: themed('text-magenta-700', brandColors.magenta[700], brandColors.magenta.light),
  },
};
const borderColor = {
  // Plain `border` and Preflight's default border colour.
  DEFAULT: themed('border-default', defaultColors.gray[200], NEUTRAL_BORDER[200]),
  white: themed('border-white', '#ffffff', DARK.card, { literalBelow: 0.5 }),
};
const ringColor = {
  white: themed('ring-white', '#ffffff', DARK.card, { literalBelow: 0.5 }),
};

for (const family of NEUTRALS) {
  backgroundColor[family] = scale('bg', family, NEUTRAL_BG, { literalBelow: 1 });
  textColor[family] = scale('text', family, NEUTRAL_TEXT);
  borderColor[family] = scale('border', family, NEUTRAL_BORDER);
  ringColor[family] = {
    ...scale('ring', family, { 100: NEUTRAL_BORDER[100], 200: NEUTRAL_BORDER[200], 300: NEUTRAL_BORDER[300] }),
    ...scale('ring', family, { 900: NEUTRAL_TEXT[700] }),
  };
}

for (const family of TINTS) {
  const c = defaultColors[family];
  backgroundColor[family] = scale('bg', family, {
    50: mix(c[500], DARK.card, 0.1),
    100: mix(c[500], DARK.card, 0.16),
    200: mix(c[500], DARK.card, 0.26),
  });
  textColor[family] = scale('text', family, {
    600: c[400],
    700: c[300],
    800: c[200],
    900: c[100],
    950: c[50],
  });
  borderColor[family] = scale('border', family, {
    100: mix(c[500], DARK.card, 0.2),
    200: mix(c[500], DARK.card, 0.3),
    300: mix(c[500], DARK.card, 0.42),
  });
}

/**
 * `ink`: the Offboarding page was designed on its own neutral and accent ramp
 * and used it as arbitrary hex classes (`text-[#11151C]`), which no palette can
 * reach. Each key keeps that exact light value; the dark value depends on the
 * utility, as for the neutrals above.
 */
const INK = {
  //          light       bg (dark)                                  text (dark)            border (dark)
  canvas: ['#F4F5F7', DARK.page, null, null],
  20: ['#FCFCFD', NEUTRAL_BG[50], null, null],
  30: ['#F8F9FB', NEUTRAL_BG[50], null, null],
  40: ['#F7F8FA', NEUTRAL_BG[50], null, null],
  50: ['#F4F5F7', NEUTRAL_BG[100], null, null],
  75: ['#F1F3F6', NEUTRAL_BG[100], null, NEUTRAL_BORDER[100]],
  100: ['#EEF0F3', NEUTRAL_BG[200], null, NEUTRAL_BORDER[100]],
  150: ['#E7E9EE', null, null, '#2a2e36'],
  200: ['#E1E4EA', NEUTRAL_BG[200], null, NEUTRAL_BORDER[200]],
  300: ['#C9CED8', null, '#6b7280', null],
  400: ['#9AA2AE', null, '#858c98', null],
  500: ['#8A93A0', null, '#9aa1ac', null],
  600: ['#6B7480', null, NEUTRAL_TEXT[500], null],
  700: ['#4A5361', null, NEUTRAL_TEXT[600], null],
  800: ['#3D4652', null, NEUTRAL_TEXT[700], null],
  950: ['#11151C', NEUTRAL_BG[900], NEUTRAL_TEXT[900], null],
  brand: ['#E5007D', null, brandColors.magenta.hover, null],
  'brand-hover': ['#C90070', null, null, null],
  'brand-deep': ['#B80064', null, brandColors.magenta.light, null],
  'brand-50': ['#FFF5FA', mix(brandColors.magenta.DEFAULT, DARK.card, 0.1), null, null],
  'brand-100': ['#FDE7F3', mix(brandColors.magenta.DEFAULT, DARK.card, 0.18), null, null],
  'brand-200': ['#FBD3E7', null, null, mix(brandColors.magenta.DEFAULT, DARK.card, 0.35)],
  amber: ['#B26A00', null, defaultColors.amber[300], null],
  'amber-50': ['#FDF1DF', mix(defaultColors.amber[500], DARK.card, 0.14), null, null],
  teal: ['#0E7C86', null, defaultColors.teal[300], null],
  'teal-50': ['#E6F6F7', mix(defaultColors.teal[500], DARK.card, 0.14), null, null],
};
export const inkColors = Object.fromEntries(Object.entries(INK).map(([key, [light]]) => [key, light]));
backgroundColor.ink = {};
textColor.ink = {};
borderColor.ink = {};
for (const [key, [light, bg, text, border]] of Object.entries(INK)) {
  if (bg) backgroundColor.ink[key] = themed(`bg-ink-${key}`, light, bg, { literalBelow: 1 });
  if (text) textColor.ink[key] = themed(`text-ink-${key}`, light, text);
  if (border) borderColor.ink[key] = themed(`border-ink-${key}`, light, border);
}
// Magenta shades the webinar pages wrote as hex.
textColor.magenta.deep = themed('text-magenta-deep', '#b0005f', brandColors.magenta.light);

export const themedPalette = {
  backgroundColor,
  textColor,
  borderColor,
  ringColor,
  ringOffsetColor: { white: themed('ring-offset-white', '#ffffff', DARK.card) },
};

// --- CSS variables ----------------------------------------------------------
const vars = mode => Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--ix-${name}`, value[mode]]));

/** Emits the light values on :root, the dark values on html.dark and restores the
 *  original values inside `.theme-fixed`. */
export const themePalettePlugin = ({ addBase }) => {
  addBase({
    ':root': vars('light'),
    '.dark': { ...vars('dark'), colorScheme: 'dark' },
    '.dark .theme-fixed': { ...vars('light'), colorScheme: 'light' },
    // Printing (certificates, reports) always uses the light palette.
    '@media print': { '.dark': { ...vars('light'), colorScheme: 'light' } },
    // Preflight sets the ring-offset gap to white on every element.
    '.dark *, .dark ::before, .dark ::after': { '--tw-ring-offset-color': DARK.card },
    '.dark .theme-fixed, .dark .theme-fixed *, .dark .theme-fixed ::before, .dark .theme-fixed ::after': {
      '--tw-ring-offset-color': '#ffffff',
    },
  });
};
