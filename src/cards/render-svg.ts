import type { Draw } from '../ingest/adapter.ts';

/**
 * Render a lottery result card as an SVG string.
 * Dark theme with numbered ball circles for the draw results.
 */
export function renderSvg(draw: Draw): string {
  const width = 600;
  const padding = 32;
  const ballSize = 48;
  const ballGap = 12;

  const numbers = draw.numbers.map(String);
  const ballsWidth = numbers.length * (ballSize + ballGap) - ballGap;

  // Dynamic height based on content sections
  const headerY = padding;
  const dateY = headerY + 48;
  const ballsY = dateY + 52;
  const ballCenterY = ballsY + ballSize / 2;
  const infoY = ballsY + ballSize + 28;
  const height = infoY + 120;

  const ballsSvg = numbers
    .map((num, i) => {
      const x = padding + i * (ballSize + ballGap);
      return `
      <circle cx="${x + ballSize / 2}" cy="${ballCenterY}" r="${ballSize / 2}"
        fill="#e2e8f0" stroke="#334155" stroke-width="2"/>
      <text x="${x + ballSize / 2}" y="${ballCenterY + 1}"
        text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#0f172a">
        ${num}
      </text>`;
    })
    .join('');

  const bonusSection =
    draw.bonus && draw.bonus.length > 0
      ? `
      <text x="${padding}" y="${infoY}" font-family="system-ui, sans-serif"
        font-size="14" fill="#94a3b8" font-weight="600">BONUS</text>
      ${draw.bonus
        .map(
          (b, i) => `
      <circle cx="${padding + 24 + i * 40}" cy="${infoY + 24}" r="18"
        fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
      <text x="${padding + 24 + i * 40}" y="${infoY + 25}"
        text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#78350f">
        ${b}
      </text>`,
        )
        .join('')}`
      : '';

  const extraInfo: string[] = [];
  if (draw.multiplier !== null) {
    extraInfo.push(`MULTIPLIER: ×${draw.multiplier}`);
  }
  if (draw.jackpot !== null) {
    extraInfo.push(`JACKPOT: $${draw.jackpot.toLocaleString('en-US')}`);
  }
  const extraY = infoY + (draw.bonus && draw.bonus.length > 0 ? 64 : 0);

  const extraSection =
    extraInfo.length > 0
      ? `
      <text x="${padding}" y="${extraY}"
        font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">
        ${extraInfo.join('   •   ')}
      </text>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="16" fill="url(#bg)"/>

  <!-- Header -->
  <text x="${padding}" y="${headerY + 28}"
    font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#f8fafc">
    ${draw.gameName}
  </text>
  <text x="${width - padding}" y="${headerY + 28}"
    text-anchor="end" font-family="system-ui, sans-serif"
    font-size="16" font-weight="600" fill="#38bdf8">
    ${draw.state}
  </text>

  <!-- Date -->
  <text x="${padding}" y="${dateY + 24}"
    font-family="system-ui, sans-serif" font-size="14" fill="#64748b">
    ${draw.drawDate} • ${draw.drawType.charAt(0).toUpperCase() + draw.drawType.slice(1)}
  </text>

  <!-- Numbers -->
  ${ballsSvg}

  <!-- Bonus -->
  ${bonusSection}

  <!-- Extra info -->
  ${extraSection}

  <!-- Footer -->
  <text x="${padding}" y="${height - 16}"
    font-family="system-ui, sans-serif" font-size="11" fill="#475569">
    Source: ${draw.sourceRef}
  </text>
  <text x="${width - padding}" y="${height - 16}"
    text-anchor="end" font-family="system-ui, sans-serif" font-size="11" fill="#475569">
    mzllo-boliteros
  </text>
</svg>`;
}
