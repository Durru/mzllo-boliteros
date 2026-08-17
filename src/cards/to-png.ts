import sharp from 'sharp';

/**
 * Convert an SVG string to a PNG buffer using sharp.
 * @throws if SVG is invalid or sharp fails
 */
export async function toPng(svg: string): Promise<Buffer> {
  const result = await sharp(Buffer.from(svg), { density: 150 })
    .png()
    .toBuffer();
  return result;
}
