/**
 * PWA Icon Generator
 *
 * Generates PWA icons with gradient background and "P2P" text.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcon(size) {
  // Create SVG with gradient background and P2P text
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}" ry="${size * 0.2}"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.35}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >P2P</text>
    </svg>
  `;

  const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`Generated: icon-${size}x${size}.png`);
}

async function generateAppleTouchIcon() {
  const size = 180;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}" ry="${size * 0.2}"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.35}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >P2P</text>
    </svg>
  `;

  const outputPath = path.join(outputDir, 'apple-touch-icon.png');

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log('Generated: apple-touch-icon.png');
}

async function generateFavicon() {
  const size = 32;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="6" ry="6"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.45}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >P</text>
    </svg>
  `;

  // Generate favicon.ico (32x32)
  await sharp(Buffer.from(svg))
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));

  // Also generate 16x16 version
  await sharp(Buffer.from(svg))
    .resize(16, 16)
    .png()
    .toFile(path.join(outputDir, 'favicon-16x16.png'));

  await sharp(Buffer.from(svg))
    .resize(32, 32)
    .png()
    .toFile(path.join(outputDir, 'favicon-32x32.png'));

  console.log('Generated: favicon.png, favicon-16x16.png, favicon-32x32.png');
}

async function generateScreenshot() {
  const width = 1080;
  const height = 1920;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a0a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#171717;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect x="390" y="750" width="300" height="300" fill="url(#accent)" rx="60" ry="60"/>
      <text
        x="540"
        y="930"
        font-family="Arial, sans-serif"
        font-size="100"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >P2P</text>
      <text
        x="540"
        y="1150"
        font-family="Arial, sans-serif"
        font-size="48"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
      >P2P Network</text>
      <text
        x="540"
        y="1220"
        font-family="Arial, sans-serif"
        font-size="28"
        fill="#a3a3a3"
        text-anchor="middle"
      >Professional Networking Platform</text>
    </svg>
  `;

  const screenshotsDir = path.join(__dirname, '../public/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toFile(path.join(screenshotsDir, 'screenshot-1.png'));

  console.log('Generated: screenshot-1.png');
}

async function main() {
  console.log('Generating PWA icons...\n');

  // Generate all size icons
  for (const size of sizes) {
    await generateIcon(size);
  }

  // Generate Apple touch icon
  await generateAppleTouchIcon();

  // Generate favicon
  await generateFavicon();

  // Generate screenshot
  await generateScreenshot();

  console.log('\nAll icons generated successfully!');
}

main().catch(console.error);
