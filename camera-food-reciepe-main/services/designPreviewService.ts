interface DesignPreviewRequest {
  recipeName: string;
  matchedIngredients?: string[];
  missingIngredients?: string[];
  artStyle?: string;
}

export interface DesignPreviewResponse {
  dataUrl: string;
  prompt: string;
}

const DEFAULT_ART_STYLE = 'warm tabletop scene with soft watercolor lighting';

const palette = [
  ['#FEF3C7', '#FDBA74', '#F97316'],
  ['#DBEAFE', '#A5B4FC', '#6366F1'],
  ['#DCFCE7', '#86EFAC', '#16A34A'],
  ['#FCE7F3', '#F9A8D4', '#EC4899'],
  ['#FFE4E6', '#FCA5A5', '#EF4444'],
  ['#E0F2FE', '#7DD3FC', '#0EA5E9'],
];

const secondaryPalette = ['#0F172A', '#111827', '#1F2937', '#312E81', '#4C1D95', '#1E3A8A'];

const toBase64 = (value: string) => {
  if (typeof btoa === 'function') {
    return btoa(
      encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, code: string) =>
        String.fromCharCode(parseInt(code, 16))
      )
    );
  }
  return Buffer.from(value, 'utf-8').toString('base64');
};

const escapeForSvg = (value: string) =>
  value.replace(/[&<>'"]/g, character => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return character;
    }
  });

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildPrompt = ({
  recipeName,
  matchedIngredients = [],
  missingIngredients = [],
  artStyle = DEFAULT_ART_STYLE,
}: DesignPreviewRequest) => {
  const matched = matchedIngredients.filter(Boolean).join(', ');
  const missing = missingIngredients.filter(Boolean).join(', ');
  const parts = [`Create an illustrated journal card for the recipe “${recipeName}”.`];

  if (matched) {
    parts.push(`Highlight on-hand ingredients: ${matched}.`);
  }

  if (missing) {
    parts.push(`Suggest what's missing: ${missing}.`);
  }

  parts.push(`Overall art direction: ${artStyle}.`);
  return parts.join(' ');
};

const buildSvg = (
  request: DesignPreviewRequest,
  prompt: string,
  colors: string[],
  accent: string
) => {
  const { recipeName } = request;
  const matched = request.matchedIngredients?.filter(Boolean) ?? [];
  const missing = request.missingIngredients?.filter(Boolean) ?? [];
  const artStyle = request.artStyle ?? DEFAULT_ART_STYLE;

  const bannerText = escapeForSvg(recipeName);
  const matchedText = escapeForSvg(matched.slice(0, 5).join(' · ') || 'On-hand ingredients recorded');
  const missingText = escapeForSvg(
    missing.length > 0 ? `Pick up: ${missing.slice(0, 5).join(', ')}` : 'Everything you need is here'
  );
  const artStyleText = escapeForSvg(artStyle);
  const promptText = escapeForSvg(prompt);

  const overlayOpacity = 0.14 + (colors[2].length % 4) * 0.06;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors[0]}" />
      <stop offset="50%" stop-color="${colors[1]}" />
      <stop offset="100%" stop-color="${colors[2]}" />
    </linearGradient>
    <pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${accent}" opacity="0.08" />
      <circle cx="4" cy="3" r="1" fill="${accent}" opacity="0.1" />
      <circle cx="7" cy="2" r="1" fill="${accent}" opacity="0.06" />
      <circle cx="3" cy="6" r="1" fill="${accent}" opacity="0.08" />
    </pattern>
    <clipPath id="card-clip">
      <rect x="16" y="16" width="388" height="268" rx="28" ry="28" />
    </clipPath>
  </defs>
  <g clip-path="url(#card-clip)">
    <rect x="16" y="16" width="388" height="268" fill="url(#bg)" />
    <rect x="16" y="16" width="388" height="268" fill="url(#grain)" />
    <path d="M16 150 C140 120 220 210 404 130 L404 284 L16 284 Z" fill="${accent}" opacity="${overlayOpacity.toFixed(2)}" />
  </g>
  <rect x="16" y="16" width="388" height="268" rx="28" ry="28" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.6" />
  <text x="32" y="72" font-family="'Pretendard', 'Inter', sans-serif" font-weight="700" font-size="26" fill="${secondaryPalette[hashString(recipeName) % secondaryPalette.length]}" letter-spacing="0.8">
    ${bannerText}
  </text>
  <text x="32" y="108" font-family="'Pretendard', 'Inter', sans-serif" font-size="13" fill="#1F2937" opacity="0.78">
    ${artStyleText}
  </text>
  <text x="32" y="144" font-family="'Pretendard', 'Inter', sans-serif" font-size="12" fill="#1F2937" opacity="0.86">
    ${matchedText}
  </text>
  <text x="32" y="170" font-family="'Pretendard', 'Inter', sans-serif" font-size="12" fill="#1F2937" opacity="0.7">
    ${missingText}
  </text>
  <text x="32" y="210" font-family="'Pretendard', 'Inter', sans-serif" font-size="10" fill="#111827" opacity="0.5" letter-spacing="0.4">
    ${promptText}
  </text>
  <text x="32" y="244" font-family="'Pretendard', 'Inter', sans-serif" font-size="10" fill="#111827" opacity="0.38">
    auto-generated thumbnail preview
  </text>
</svg>`;
};

export const designPreviewService = async (
  request: DesignPreviewRequest
): Promise<DesignPreviewResponse> => {
  const prompt = buildPrompt(request);
  const paletteIndex = hashString(prompt) % palette.length;
  const accentIndex = hashString(`${prompt}:${request.recipeName}`) % secondaryPalette.length;
  const colors = palette[paletteIndex];
  const accent = secondaryPalette[accentIndex];
  const svg = buildSvg(request, prompt, colors, accent);
  const encoded = toBase64(svg);
  const dataUrl = `data:image/svg+xml;base64,${encoded}`;

  // small async pause to emulate network fetch and allow UI affordances
  await new Promise(resolve => {
    setTimeout(resolve, 120);
  });

  return { dataUrl, prompt };
};
