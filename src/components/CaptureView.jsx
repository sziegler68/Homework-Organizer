import { useState, useRef } from 'react';
import { createHomeworkZip } from '../utils/ZipService';
import { createHomeworkPdf } from '../utils/PdfService';
import { loadImage, processDocument } from '../utils/ImageProcessor';
import { log, getEntries, downloadLog, clearLog } from '../utils/ErrorLogger';
import DocumentCropEditor from './DocumentCropEditor';

export default function CaptureView({ meta, onReset }) {
    // Photos that have been processed and are ready for export
    const [photos, setPhotos] = useState([]);
    const [isZipping, setIsZipping] = useState(false);
    const [isPdfing, setIsPdfing] = useState(false);

    // Document scanning state
    const [pendingPhoto, setPendingPhoto] = useState(null);
    const [galleryQueue, setGalleryQueue] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Error log badge count (drives re-render when errors are logged)
    const [errorCount, setErrorCount] = useState(getEntries().length);

    const fileInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const baseName = `${meta.initials}${meta.className}Week${meta.week}HW`;

    // Handle photo capture - opens crop editor
    const handleCapture = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            log('info', 'CaptureView.handleCapture', 'Photo captured', {
                fileName: files[0].name,
                fileSize: files[0].size,
                fileType: files[0].type,
            });
            // Open the crop editor with the first captured image
            setPendingPhoto(files[0]);
        }
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    };

    // Handle gallery selection - queue files and process one at a time
    const handleGallerySelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            log('info', 'CaptureView.handleGallerySelect', `${files.length} file(s) selected`, {
                files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
            });
            // First file goes straight to crop editor, rest are queued
            setPendingPhoto(files[0]);
            if (files.length > 1) {
                setGalleryQueue(files.slice(1));
            }
        }
        e.target.value = '';
    };

    // Handle crop confirmation - process the image
    const handleCropConfirm = async (corners) => {
        if (!pendingPhoto) return;

        setIsProcessing(true);
        log('info', 'CaptureView.handleCropConfirm', 'Starting crop processing', {
            fileName: pendingPhoto.name,
            fileSize: pendingPhoto.size,
            corners,
        });

        try {
            // Load the image
            const img = await loadImage(pendingPhoto);
            log('info', 'CaptureView.handleCropConfirm', 'Image loaded', {
                naturalWidth: img.naturalWidth || img.width,
                naturalHeight: img.naturalHeight || img.height,
            });

            // Process the document (perspective correction + enhancement)
            const processedBlob = await processDocument(img, corners, {
                contrast: 1.4,
                brightness: 20,
                grayscale: false
            });

            log('info', 'CaptureView.handleCropConfirm', 'Document processed', {
                blobSize: processedBlob?.size,
                blobType: processedBlob?.type,
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
            log('error', 'CaptureView.handleCropConfirm', 'Failed to process document', {
                fileName: pendingPhoto?.name,
                fileSize: pendingPhoto?.size,
                fileType: pendingPhoto?.type,
                corners,
            }, error);
            setErrorCount(getEntries().length);
            alert('Failed to process document: ' + (error.message || error));
        } finally {
            setIsProcessing(false);
            // If there are queued gallery images, load the next one
            if (galleryQueue.length > 0) {
                const [next, ...rest] = galleryQueue;
                setPendingPhoto(next);
                setGalleryQueue(rest);
            } else {
                setPendingPhoto(null);
            }
        }
    };

    // Handle crop cancel
    const handleCropCancel = () => {
        setPendingPhoto(null);
        setGalleryQueue([]); // Clear any remaining queued gallery images
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
            log('error', 'CaptureView.handleZip', 'Failed to create zip', {}, error);
            setErrorCount(getEntries().length);
            alert('Failed to create zip file: ' + (error.message || error));
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
            log('error', 'CaptureView.handlePdf', 'Failed to create PDF', {}, error);
            setErrorCount(getEntries().length);
            alert('Failed to create PDF file: ' + (error.message || error));
        } finally {
            setIsPdfing(false);
        }
    };

    const handleDownloadLog = () => {
        downloadLog();
    };

    const handleClearLog = () => {
        clearLog();
        setErrorCount(0);
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

                {/* Capture & Gallery Buttons */}
                <div className="capture-actions">
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
                    <div className="capture-btn-wrapper gallery-btn-wrapper">
                        <button className="btn gallery-btn">
                            🖼️ Gallery
                        </button>
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleGallerySelect}
                        />
                    </div>
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

                {/* Debug Log Controls */}
                {errorCount > 0 && (
                    <div className="debug-bar">
                        <span className="debug-badge">⚠ {errorCount} log entries</span>
                        <button className="btn btn-secondary debug-btn" onClick={handleDownloadLog}>
                            ⬇ Download Log
                        </button>
                        <button className="btn btn-secondary debug-btn" onClick={handleClearLog}>
                            ✕ Clear
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
