import sharp from "sharp";

/** Replace near-black background pixels with white; keep blue/green logo colors. */
export async function imageOnWhite(src) {
  const pipeline = sharp(src).ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 48 && g < 48 && b < 48) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      if (ch === 4) data[i + 3] = 255;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).flatten({
    background: { r: 255, g: 255, b: 255 },
  });
}
