/**
 * ImageProcessor - Document scanning image processing utility
 * Handles perspective correction and image enhancement for scanned documents.
 */

/**
 * Applies perspective correction to an image based on 4 corner points.
 * Uses a simple approach that maps the quadrilateral to a rectangle.
 * 
 * @param {HTMLImageElement} image - The source image
 * @param {Object[]} corners - Array of 4 corner points [{x, y}, ...] in order: TL, TR, BR, BL
 * @param {number} outputWidth - Desired output width
 * @param {number} outputHeight - Desired output height
 * @returns {HTMLCanvasElement} - Canvas with the corrected image
 */
export function applyPerspectiveCorrection(image, corners, outputWidth = 816, outputHeight = 1056) {
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    // Get corner coordinates
    const [tl, tr, br, bl] = corners;

    // Calculate the source quadrilateral dimensions for interpolation
    const srcWidth = Math.max(
        Math.hypot(tr.x - tl.x, tr.y - tl.y),
        Math.hypot(br.x - bl.x, br.y - bl.y)
    );
    const srcHeight = Math.max(
        Math.hypot(bl.x - tl.x, bl.y - tl.y),
        Math.hypot(br.x - tr.x, br.y - tr.y)
    );

    // Use a temporary canvas at source resolution for better quality
    const tempCanvas = document.createElement('canvas');
    const tempWidth = Math.round(srcWidth);
    const tempHeight = Math.round(srcHeight);
    tempCanvas.width = tempWidth;
    tempCanvas.height = tempHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Get source image data
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = image.naturalWidth || image.width;
    srcCanvas.height = image.naturalHeight || image.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(image, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

    // Create output image data
    const outData = tempCtx.createImageData(tempWidth, tempHeight);

    // Bilinear interpolation for perspective mapping
    for (let y = 0; y < tempHeight; y++) {
        for (let x = 0; x < tempWidth; x++) {
            // Normalized coordinates (0-1)
            const u = x / tempWidth;
            const v = y / tempHeight;

            // Bilinear interpolation of source coordinates
            const srcX = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
            const srcY = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;

            // Sample source pixel (with bounds checking)
            const sx = Math.round(srcX);
            const sy = Math.round(srcY);

            if (sx >= 0 && sx < srcCanvas.width && sy >= 0 && sy < srcCanvas.height) {
                const srcIdx = (sy * srcCanvas.width + sx) * 4;
                const outIdx = (y * tempWidth + x) * 4;
                outData.data[outIdx] = srcData.data[srcIdx];
                outData.data[outIdx + 1] = srcData.data[srcIdx + 1];
                outData.data[outIdx + 2] = srcData.data[srcIdx + 2];
                outData.data[outIdx + 3] = srcData.data[srcIdx + 3];
            }
        }
    }

    tempCtx.putImageData(outData, 0, 0);

    // Scale to output size
    ctx.drawImage(tempCanvas, 0, 0, outputWidth, outputHeight);

    return canvas;
}

/**
 * Applies adaptive lighting correction to handle uneven illumination.
 * Uses local brightness normalization to reduce shadows and flash hotspots.
 * 
 * @param {HTMLCanvasElement} canvas - The source canvas
 * @param {Object} options - Options
 * @param {number} options.blockSize - Size of blocks for local analysis (default 32)
 * @param {number} options.strength - Correction strength 0-1 (default 0.7)
 * @returns {HTMLCanvasElement} - Corrected canvas
 */
export function adaptiveLightingCorrection(canvas, options = {}) {
    const {
        blockSize = 24,
        strength = 0.9
    } = options;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Calculate number of blocks
    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);

    // Calculate average brightness for each block
    const blockBrightness = new Float32Array(blocksX * blocksY);
    const blockCounts = new Uint32Array(blocksX * blocksY);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

            const bx = Math.floor(x / blockSize);
            const by = Math.floor(y / blockSize);
            const blockIdx = by * blocksX + bx;

            blockBrightness[blockIdx] += brightness;
            blockCounts[blockIdx]++;
        }
    }

    // Average the block brightness
    for (let i = 0; i < blockBrightness.length; i++) {
        if (blockCounts[i] > 0) {
            blockBrightness[i] /= blockCounts[i];
        }
    }

    // Calculate global average brightness
    let globalBrightness = 0;
    for (let i = 0; i < blockBrightness.length; i++) {
        globalBrightness += blockBrightness[i];
    }
    globalBrightness /= blockBrightness.length;

    // Target brightness - use global average for even correction
    // This normalizes both shadows (dark) and hotspots (bright) toward the average
    const targetBrightness = globalBrightness;

    // Apply adaptive correction
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            // Get interpolated local brightness using bilinear interpolation
            const fx = (x / blockSize) - 0.5;
            const fy = (y / blockSize) - 0.5;

            const bx0 = Math.max(0, Math.floor(fx));
            const by0 = Math.max(0, Math.floor(fy));
            const bx1 = Math.min(blocksX - 1, bx0 + 1);
            const by1 = Math.min(blocksY - 1, by0 + 1);

            const tx = Math.max(0, Math.min(1, fx - bx0));
            const ty = Math.max(0, Math.min(1, fy - by0));

            // Bilinear interpolation of local brightness
            const b00 = blockBrightness[by0 * blocksX + bx0];
            const b10 = blockBrightness[by0 * blocksX + bx1];
            const b01 = blockBrightness[by1 * blocksX + bx0];
            const b11 = blockBrightness[by1 * blocksX + bx1];

            const localBrightness =
                b00 * (1 - tx) * (1 - ty) +
                b10 * tx * (1 - ty) +
                b01 * (1 - tx) * ty +
                b11 * tx * ty;

            // Calculate correction factor
            // If local area is dark (shadow), brighten it
            // If local area is bright (flash), dim it slightly
            let correctionFactor = 1;
            if (localBrightness > 0) {
                correctionFactor = targetBrightness / localBrightness;
                // Blend with 1.0 based on strength
                correctionFactor = 1 + (correctionFactor - 1) * strength;
                // Limit extreme corrections
                correctionFactor = Math.max(0.5, Math.min(2.0, correctionFactor));
            }

            // Apply correction
            data[idx] = Math.min(255, data[idx] * correctionFactor);
            data[idx + 1] = Math.min(255, data[idx + 1] * correctionFactor);
            data[idx + 2] = Math.min(255, data[idx + 2] * correctionFactor);
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Enhances an image to look like a scanned document.
 * Applies contrast boost and ensures text is dark on white background.
 * 
 * @param {HTMLCanvasElement} canvas - The source canvas
 * @param {Object} options - Enhancement options
 * @param {number} options.contrast - Contrast multiplier (1.0 = no change, 1.5 = 50% more)
 * @param {number} options.brightness - Brightness adjustment (-255 to 255)
 * @param {boolean} options.grayscale - Convert to grayscale
 * @returns {HTMLCanvasElement} - Enhanced canvas
 */
export function enhanceDocument(canvas, options = {}) {
    const {
        contrast = 1.5,
        brightness = 10,
        grayscale = false
    } = options;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Convert to grayscale if requested
        if (grayscale) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = gray;
        }

        // Apply contrast (centered around 128)
        r = ((r - 128) * contrast) + 128;
        g = ((g - 128) * contrast) + 128;
        b = ((b - 128) * contrast) + 128;

        // Apply brightness
        r += brightness;
        g += brightness;
        b += brightness;

        // Clamp values
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Processes a captured photo through the full document scanning pipeline.
 * 
 * @param {HTMLImageElement} image - Source image element
 * @param {Object[]} corners - 4 corner points [{x, y}, ...] in order: TL, TR, BR, BL
 * @param {Object} options - Processing options
 * @returns {Promise<Blob>} - Processed image as JPEG blob
 */
export async function processDocument(image, corners, options = {}) {
    const {
        outputWidth = 816,  // 8.5" at 96dpi
        outputHeight = 1056, // 11" at 96dpi
        contrast = 1.5,
        brightness = 10,
        grayscale = false,
        quality = 0.92,
        adaptiveLighting = true,
        lightingStrength = 0.9
    } = options;

    // Apply perspective correction
    let canvas = applyPerspectiveCorrection(image, corners, outputWidth, outputHeight);

    // Apply adaptive lighting correction to handle shadows and flash hotspots
    if (adaptiveLighting) {
        canvas = adaptiveLightingCorrection(canvas, { strength: lightingStrength });
    }

    // Apply document enhancement
    canvas = enhanceDocument(canvas, { contrast, brightness, grayscale });

    // Convert to blob
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
    });
}

/**
 * Loads an image from a File or Blob.
 * 
 * @param {File|Blob} file - Image file
 * @returns {Promise<HTMLImageElement>} - Loaded image element
 */
export function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Gets default corner positions for an image (with small margin).
 * 
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} margin - Margin from edges (0-1, default 0.05 = 5%)
 * @returns {Object[]} - Array of 4 corner points
 */
export function getDefaultCorners(width, height, margin = 0.05) {
    const mx = width * margin;
    const my = height * margin;

    return [
        { x: mx, y: my },                    // Top-left
        { x: width - mx, y: my },            // Top-right
        { x: width - mx, y: height - my },   // Bottom-right
        { x: mx, y: height - my }            // Bottom-left
    ];
}
