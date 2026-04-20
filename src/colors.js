// Curated CSS color names for photographic palettes.
// Cleaned of names that are too generic ("white"/"black"/"gray") or too saturated/neon.
const NAMED = {
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgreen: [0, 100, 0],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  dimgray: [105, 105, 105],
  firebrick: [178, 34, 34],
  forestgreen: [34, 139, 34],
  gainsboro: [220, 220, 220],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  gray: [128, 128, 128],
  honeydew: [240, 255, 240],
  indianred: [205, 92, 92],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightgoldenrodyellow: [250, 250, 210],
  lightgreen: [144, 238, 144],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  linen: [250, 240, 230],
  maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  navy: [0, 0, 128],
  olive: [128, 128, 0],
  olivedrab: [107, 142, 35],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  silver: [192, 192, 192],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  snow: [255, 250, 250],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  teal: [0, 128, 128],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  wheat: [245, 222, 179]
};

const NAME_ENTRIES = Object.entries(NAMED);

export function nearestColorName([r, g, b]) {
  let best = null;
  let bestD = Infinity;
  for (const [name, rgb] of NAME_ENTRIES) {
    const dr = r - rgb[0];
    const dg = g - rgb[1];
    const db = b - rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

// Quantize pixels (sample every Nth pixel), bucket into 32-step color cubes,
// return up to `count` dominant named colors, skipping near-duplicates.
export function dominantColors(canvas, count = 3) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const sample = ctx.getImageData(0, 0, w, h);
  const buckets = new Map();
  const step = 4 * 8; // sample every 8th pixel
  for (let i = 0; i < sample.data.length; i += step) {
    const r = sample.data[i];
    const g = sample.data[i + 1];
    const b = sample.data[i + 2];
    const key = `${r >> 5}_${g >> 5}_${b >> 5}`;
    const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.n += 1;
    buckets.set(key, entry);
  }
  const ranked = [...buckets.values()]
    .filter((e) => e.n > 4)
    .map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n), e.n])
    .sort((a, b) => b[3] - a[3]);

  const chosen = [];
  const seen = new Set();
  for (const [r, g, b] of ranked) {
    const name = nearestColorName([r, g, b]);
    if (seen.has(name)) continue;
    seen.add(name);
    chosen.push(name);
    if (chosen.length >= count) break;
  }
  return chosen;
}
