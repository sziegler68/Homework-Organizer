import { jsPDF } from 'jspdf';

/**
 * Creates a PDF file from the provided photos with proper naming.
 * @param {Object} meta - Metadata object { initials, className, week }
 * @param {File[]} photos - Array of File objects (images)
 * @returns {Promise<void>}
 */
export async function createHomeworkPdf(meta, photos) {
  const { initials, className, week } = meta;
  const baseName = `${initials}${className}Week${week}HW`;
  
  // Create PDF document (default a4, portrait)
  const doc = new jsPDF();
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    
    // Add new page for subsequent images
    if (i > 0) {
      doc.addPage();
    }
    
    // Convert image to base64 data URL
    const imgData = await fileToDataUrl(photo);
    const imgProps = doc.getImageProperties(imgData);
    
    // Calculate aspect ratio to fit page
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - (margin * 2);
    
    const imgRatio = imgProps.width / imgProps.height;
    const pageRatio = availableWidth / availableHeight;
    
    let finalWidth, finalHeight;
    
    if (imgRatio > pageRatio) {
      // Image is wider than page area -> limit by width
      finalWidth = availableWidth;
      finalHeight = availableWidth / imgRatio;
    } else {
      // Image is taller than page area -> limit by height
      finalWidth = availableHeight * imgRatio;
      finalHeight = availableHeight;
    }
    
    // Center image on page
    const x = (pageWidth - finalWidth) / 2;
    const y = (pageHeight - finalHeight) / 2;
    
    doc.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
    
    // Optional: Add page number text at bottom
    doc.setFontSize(10);
    doc.text(`Page ${i + 1}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }
  
  // Save the PDF
  doc.save(`${baseName}.pdf`);
}

/**
 * Converts a File object to a data URL string.
 * @param {File} file 
 * @returns {Promise<string>}
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
