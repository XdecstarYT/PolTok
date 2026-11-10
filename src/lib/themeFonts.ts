/**
 * Webfonts per theme: only the active theme's families are requested.
 * index.html has an inline copy of this map for the first paint; keep the two in sync.
 */
const GF = 'https://fonts.googleapis.com/css2?';
const SPACE = 'family=Space+Grotesk:wght@400;500;600;700';
const INTER = 'family=Inter:wght@400;500;600;700;800';
const JB = 'family=JetBrains+Mono:wght@400;600;700';
const PLEX = 'family=IBM+Plex+Mono:wght@400;600;700';
const TIGHT = 'family=Inter+Tight:wght@500;600;700;800';
const NEWS = 'family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700';

export const THEME_FONTS: Record<string, string> = {
  command: `${TIGHT}&${INTER}&${NEWS}&${JB}`,
  aurora: `${SPACE}&${INTER}&${JB}`,
  broadcast: `family=Oswald:wght@500;600;700&family=Roboto+Condensed:wght@400;700;900&${JB}`,
  paper: `family=Playfair+Display:wght@600;700;900&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&${PLEX}`,
  terminal: PLEX,
};

export function themeFontHref(ui: string) {
  return `${GF}${THEME_FONTS[ui] ?? THEME_FONTS.command}&display=swap`;
}

/** Point the single theme-font <link> at the active theme's families (idempotent). */
export function loadThemeFonts(ui: string) {
  try {
    const href = themeFontHref(ui);
    let link = document.getElementById('theme-fonts') as HTMLLinkElement | null;
    if (link?.href === href) return;
    if (!link) {
      link = document.createElement('link');
      link.id = 'theme-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = href;
  } catch {
    /* no DOM */
  }
}
