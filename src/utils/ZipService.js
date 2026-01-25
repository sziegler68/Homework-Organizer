import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Creates a zip file from the provided photos with proper naming.
 * @param {Object} meta - Metadata object { initials, className, week }
 * @param {File[]} photos - Array of File objects (images)
 * @returns {Promise<void>}
 */
export async function createHomeworkZip(meta, photos) {
    const { initials, className, week } = meta;
    const baseName = `${initials}${className}Week${week}HW`;

    const zip = new JSZip();

    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const ext = getFileExtension(photo.name);
        const newName = `${baseName}pg${i + 1}.${ext}`;

        // Read file as array buffer
        const arrayBuffer = await photo.arrayBuffer();
        zip.file(newName, arrayBuffer);
    }

    // Generate the zip file
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    // Trigger download
    saveAs(zipBlob, `${baseName}.zip`);
}

/**
 * Gets the file extension from a filename.
 * @param {string} filename 
 * @returns {string}
 */
function getFileExtension(filename) {
    const parts = filename.split('.');
    if (parts.length > 1) {
        return parts.pop().toLowerCase();
    }
    return 'jpg'; // Default to jpg if no extension
}
