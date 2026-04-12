/**
 * Test script for image preprocessing
 * Run with: npx ts-node test-preprocessing.ts
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// Import our preprocessing components
import { SharpPreprocessorService } from './src/infrastructure/external/preprocessing/SharpPreprocessorService';

async function testPreprocessing() {
  console.log('=== Testing Image Preprocessing ===\n');

  // Create a test image (simple colored rectangle simulating a business card)
  console.log('1. Creating test image...');

  // Create a 400x600 portrait image with VERTICAL text lines
  // This simulates a landscape card photographed sideways - should be rotated
  const testImageBuffer = await sharp({
    create: {
      width: 400,
      height: 600,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    // Add VERTICAL "text lines" (simulating sideways card)
    {
      input: Buffer.from(
        `<svg width="400" height="600">
          <rect x="100" y="50" width="20" height="500" fill="#333"/>
          <rect x="140" y="80" width="15" height="400" fill="#666"/>
          <rect x="180" y="60" width="15" height="450" fill="#666"/>
          <rect x="220" y="100" width="12" height="350" fill="#888"/>
          <rect x="260" y="70" width="18" height="420" fill="#555"/>
        </svg>`
      ),
      top: 0,
      left: 0
    }
  ])
  .jpeg()
  .toBuffer();

  console.log(`   Created test image: ${testImageBuffer.length} bytes`);

  // Save original for comparison
  fs.writeFileSync('/tmp/test-card-original.jpg', testImageBuffer);
  console.log('   Saved original to /tmp/test-card-original.jpg');

  // Test the preprocessor
  console.log('\n2. Running preprocessor...');

  const preprocessor = new SharpPreprocessorService({
    enhancementLevel: 'light',
    targetWidth: 1200,
    outputFormat: 'jpeg',
    jpegQuality: 90
  });

  const isAvailable = await preprocessor.isAvailable();
  console.log(`   Preprocessor available: ${isAvailable}`);

  if (!isAvailable) {
    console.error('   ERROR: Preprocessor not available!');
    return;
  }

  const base64Input = testImageBuffer.toString('base64');

  const startTime = Date.now();
  const result = await preprocessor.process({
    imageData: base64Input,
    mimeType: 'image/jpeg'
  });
  const elapsed = Date.now() - startTime;

  console.log('\n3. Results:');
  console.log(`   Processing time: ${elapsed}ms`);
  console.log(`   Card detected: ${result.cardDetection.isBusinessCard} (confidence: ${(result.cardDetection.confidence * 100).toFixed(1)}%)`);
  console.log(`   Card detection reason: ${result.cardDetection.reason}`);
  console.log(`   Quality score: ${(result.quality.score * 100).toFixed(1)}%`);
  console.log(`   Quality usable: ${result.quality.isUsable}`);
  console.log(`   Original size: ${result.metadata.originalSize.width}x${result.metadata.originalSize.height}`);
  console.log(`   Processed size: ${result.metadata.processedSize.width}x${result.metadata.processedSize.height}`);
  console.log(`   Transformations: ${result.metadata.transformationsApplied.join(', ')}`);

  if (result.warnings.length > 0) {
    console.log(`   Warnings: ${result.warnings.join('; ')}`);
  }

  // Save processed image
  const processedBuffer = Buffer.from(result.processedImageData, 'base64');
  fs.writeFileSync('/tmp/test-card-processed.jpg', processedBuffer);
  console.log('\n   Saved processed to /tmp/test-card-processed.jpg');

  // Check if dimensions changed (rotation happened)
  const processedMeta = await sharp(processedBuffer).metadata();
  console.log(`\n4. Dimension check:`);
  console.log(`   Original: 400x600 (portrait)`);
  console.log(`   Processed: ${processedMeta.width}x${processedMeta.height}`);

  if (processedMeta.width && processedMeta.height) {
    if (processedMeta.width > processedMeta.height) {
      console.log('   ✓ Image was rotated to landscape!');
    } else {
      console.log('   ✗ Image is still portrait');
    }
  }

  console.log('\n=== Test Complete ===');
}

testPreprocessing().catch(console.error);
