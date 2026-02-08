import { useState, useRef } from 'react';
import { createHomeworkZip } from '../utils/ZipService';
import { createHomeworkPdf } from '../utils/PdfService';
import { loadImage, processDocument } from '../utils/ImageProcessor';
import DocumentCropEditor from './DocumentCropEditor';

export default function CaptureView({ meta, onReset }) {
    // Photos that have been processed and are ready for export
    const [photos, setPhotos] = useState([]);
    const [isZipping, setIsZipping] = useState(false);
    const [isPdfing, setIsPdfing] = useState(false);

    // Document scanning state
    const [pendingPhoto, setPendingPhoto] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fileInputRef = useRef(null);

    const baseName = `${meta.initials}${meta.className}Week${meta.week}HW`;

    // Handle photo capture - opens crop editor
    const handleCapture = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Open the crop editor with the first captured image
            setPendingPhoto(files[0]);
        }
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    };

    // Handle crop confirmation - process the image
    const handleCropConfirm = async (corners) => {
        if (!pendingPhoto) return;

        setIsProcessing(true);

        try {
            // Load the image
            const img = await loadImage(pendingPhoto);

            // Process the document (perspective correction + enhancement)
            const processedBlob = await processDocument(img, corners, {
                contrast: 1.4,
                brightness: 20,
                grayscale: false
            });

            // Create a File object from the blob for consistency
            const processedFile = new File(
                [processedBlob],
                `page_${photos.length + 1}.jpg`,
                { type: 'image/jpeg' }
            );

            // Add to photos array
            setPhotos((prev) => [...prev, processedFile]);
        } catch (error) {
            console.error('Error processing document:', error);
            alert('Failed to process document. Please try again.');
        } finally {
            setIsProcessing(false);
            setPendingPhoto(null);
        }
    };

    // Handle crop cancel
    const handleCropCancel = () => {
        setPendingPhoto(null);
    };

    const handleRemove = (index) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const handleZip = async () => {
        if (photos.length === 0) return;

        setIsZipping(true);
        try {
            await createHomeworkZip(meta, photos);
        } catch (error) {
            console.error('Error creating zip:', error);
            alert('Failed to create zip file. Please try again.');
        } finally {
            setIsZipping(false);
        }
    };

    const handlePdf = async () => {
        if (photos.length === 0) return;

        setIsPdfing(true);
        try {
            await createHomeworkPdf(meta, photos);
        } catch (error) {
            console.error('Error creating PDF:', error);
            alert('Failed to create PDF file. Please try again.');
        } finally {
            setIsPdfing(false);
        }
    };

    return (
        <>
            {/* Document Crop Editor Overlay */}
            {pendingPhoto && !isProcessing && (
                <DocumentCropEditor
                    imageFile={pendingPhoto}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="processing-overlay">
                    <span className="spinner"></span>
                    <p>Processing document...</p>
                </div>
            )}

            <div className="glass-panel fade-in">
                <div className="capture-header">
                    <div className="naming-preview">{baseName}</div>
                    <div className="page-count">
                        {photos.length === 0
                            ? 'No pages captured yet'
                            : `${photos.length} page${photos.length !== 1 ? 's' : ''} scanned`}
                    </div>
                </div>

                {/* Capture Button */}
                <div className="capture-btn-wrapper">
                    <button className="btn capture-btn pulse">
                        📷 Scan Page {photos.length + 1}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCapture}
                    />
                </div>

                {/* Photo Gallery */}
                {photos.length > 0 ? (
                    <div className="photo-gallery">
                        {photos.map((photo, index) => (
                            <div key={index} className="photo-item">
                                <img
                                    src={URL.createObjectURL(photo)}
                                    alt={`Page ${index + 1}`}
                                    onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                                />
                                <span className="page-number">pg{index + 1}</span>
                                <button
                                    className="remove-btn"
                                    onClick={() => handleRemove(index)}
                                    aria-label={`Remove page ${index + 1}`}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📄</div>
                        <p>Tap the button above to scan your first page</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        className="btn btn-success"
                        onClick={handleZip}
                        disabled={photos.length === 0 || isZipping || isPdfing}
                    >
                        {isZipping ? (
                            <>
                                <span className="spinner"></span>
                                Zipping...
                            </>
                        ) : (
                            <>📦 Finish & Download Zip</>
                        )}
                    </button>

                    <button
                        className="btn"
                        style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)' }}
                        onClick={handlePdf}
                        disabled={photos.length === 0 || isZipping || isPdfing}
                    >
                        {isPdfing ? (
                            <>
                                <span className="spinner"></span>
                                Creating PDF...
                            </>
                        ) : (
                            <>📄 Finish & Download PDF</>
                        )}
                    </button>

                    <button className="btn btn-secondary" onClick={onReset}>
                        ← Start New Assignment
                    </button>
                </div>
            </div>
        </>
    );
}
