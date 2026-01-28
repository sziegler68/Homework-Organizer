import { useState, useRef } from 'react';
import { createHomeworkZip } from '../utils/ZipService';
import { createHomeworkPdf } from '../utils/PdfService';

export default function CaptureView({ meta, onReset }) {
    const [photos, setPhotos] = useState([]);
    const [isZipping, setIsZipping] = useState(false);
    const [isPdfing, setIsPdfing] = useState(false);
    const fileInputRef = useRef(null);

    const baseName = `${meta.initials}${meta.className}Week${meta.week}HW`;

    const handleCapture = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setPhotos((prev) => [...prev, ...files]);
        }
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
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
        <div className="glass-panel fade-in">
            <div className="capture-header">
                <div className="naming-preview">{baseName}</div>
                <div className="page-count">
                    {photos.length === 0
                        ? 'No pages captured yet'
                        : `${photos.length} page${photos.length !== 1 ? 's' : ''} captured`}
                </div>
            </div>

            {/* Capture Button */}
            <div className="capture-btn-wrapper">
                <button className="btn capture-btn pulse">
                    📷 Snap Page {photos.length + 1}
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
                    <p>Tap the button above to capture your first page</p>
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
    );
}
