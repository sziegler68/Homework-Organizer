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
 * Enhances an image to look like a scanned document.
 * Applies contrast boost and background whitening.
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
        contrast = 1.4,
        brightness = 20,
        grayscale = false
    } = options;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate average brightness for adaptive thresholding
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const avgBrightness = totalBrightness / (data.length / 4);

    // Dynamic brightness adjustment based on image
    const adaptiveBrightness = brightness + (128 - avgBrightness) * 0.3;

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
        r += adaptiveBrightness;
        g += adaptiveBrightness;
        b += adaptiveBrightness;

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
        contrast = 1.4,
        brightness = 20,
        grayscale = false,
        quality = 0.92
    } = options;

    // Apply perspective correction
    let canvas = applyPerspectiveCorrection(image, corners, outputWidth, outputHeight);

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
