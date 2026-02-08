import { useState, useRef, useEffect, useCallback } from 'react';
import { loadImage, getDefaultCorners } from '../utils/ImageProcessor';

/**
 * DocumentCropEditor - Full-screen overlay for manual corner selection
 * Allows users to drag 4 corners to define the document boundaries.
 */
export default function DocumentCropEditor({ imageFile, onConfirm, onCancel }) {
    const [image, setImage] = useState(null);
    const [corners, setCorners] = useState([]);
    const [activeCorner, setActiveCorner] = useState(null);
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0, scale: 1 });
    const containerRef = useRef(null);
    const imageRef = useRef(null);

    // Load image on mount
    useEffect(() => {
        if (!imageFile) return;

        loadImage(imageFile).then((img) => {
            setImage(img);
            // Set default corners with 5% margin
            setCorners(getDefaultCorners(img.naturalWidth, img.naturalHeight, 0.05));
        });
    }, [imageFile]);

    // Calculate display dimensions when image loads
    useEffect(() => {
        if (!image || !containerRef.current) return;

        const updateDisplaySize = () => {
            const container = containerRef.current;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            const imgWidth = image.naturalWidth;
            const imgHeight = image.naturalHeight;

            // Fit image within container while maintaining aspect ratio
            const scaleX = containerWidth / imgWidth;
            const scaleY = containerHeight / imgHeight;
            const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

            setDisplaySize({
                width: imgWidth * scale,
                height: imgHeight * scale,
                scale
            });
        };

        updateDisplaySize();
        window.addEventListener('resize', updateDisplaySize);
        return () => window.removeEventListener('resize', updateDisplaySize);
    }, [image]);

    // Convert display coordinates to image coordinates
    const displayToImage = useCallback((displayX, displayY) => {
        const rect = imageRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };

        return {
            x: (displayX - rect.left) / displaySize.scale,
            y: (displayY - rect.top) / displaySize.scale
        };
    }, [displaySize.scale]);

    // Convert image coordinates to display coordinates
    const imageToDisplay = useCallback((imgX, imgY) => {
        return {
            x: imgX * displaySize.scale,
            y: imgY * displaySize.scale
        };
    }, [displaySize.scale]);

    // Handle touch/mouse start
    const handlePointerDown = (e, cornerIndex) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveCorner(cornerIndex);
    };

    // Handle touch/mouse move
    const handlePointerMove = useCallback((e) => {
        if (activeCorner === null) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const imgCoords = displayToImage(clientX, clientY);

        // Clamp to image bounds
        const clampedX = Math.max(0, Math.min(image.naturalWidth, imgCoords.x));
        const clampedY = Math.max(0, Math.min(image.naturalHeight, imgCoords.y));

        setCorners((prev) => {
            const newCorners = [...prev];
            newCorners[activeCorner] = { x: clampedX, y: clampedY };
            return newCorners;
        });
    }, [activeCorner, displayToImage, image]);

    // Handle touch/mouse end
    const handlePointerUp = useCallback(() => {
        setActiveCorner(null);
    }, []);

    // Add global event listeners for dragging
    useEffect(() => {
        if (activeCorner !== null) {
            window.addEventListener('mousemove', handlePointerMove);
            window.addEventListener('mouseup', handlePointerUp);
            window.addEventListener('touchmove', handlePointerMove);
            window.addEventListener('touchend', handlePointerUp);

            return () => {
                window.removeEventListener('mousemove', handlePointerMove);
                window.removeEventListener('mouseup', handlePointerUp);
                window.removeEventListener('touchmove', handlePointerMove);
                window.removeEventListener('touchend', handlePointerUp);
            };
        }
    }, [activeCorner, handlePointerMove, handlePointerUp]);

    // Handle confirm
    const handleConfirm = () => {
        if (corners.length === 4) {
            onConfirm(corners);
        }
    };

    // Generate SVG path for the crop region outline
    const getCropPath = () => {
        if (corners.length !== 4) return '';

        const displayCorners = corners.map((c) => imageToDisplay(c.x, c.y));
        return `M ${displayCorners[0].x} ${displayCorners[0].y} 
            L ${displayCorners[1].x} ${displayCorners[1].y} 
            L ${displayCorners[2].x} ${displayCorners[2].y} 
            L ${displayCorners[3].x} ${displayCorners[3].y} Z`;
    };

    // Corner labels for accessibility
    const cornerLabels = ['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left'];

    if (!image) {
        return (
            <div className="crop-editor-overlay">
                <div className="crop-editor-loading">
                    <span className="spinner"></span>
                    <p>Loading image...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="crop-editor-overlay">
            <div className="crop-editor-header">
                <h2>Adjust Corners</h2>
                <p>Drag the corners to align with your document</p>
            </div>

            <div className="crop-editor-canvas" ref={containerRef}>
                <div
                    className="crop-editor-image-wrapper"
                    style={{
                        width: displaySize.width,
                        height: displaySize.height
                    }}
                >
                    <img
                        ref={imageRef}
                        src={URL.createObjectURL(imageFile)}
                        alt="Document to crop"
                        style={{ width: '100%', height: '100%' }}
                        draggable={false}
                    />

                    {/* SVG overlay for crop region */}
                    <svg
                        className="crop-editor-svg"
                        width={displaySize.width}
                        height={displaySize.height}
                    >
                        {/* Darkened area outside crop region */}
                        <defs>
                            <mask id="cropMask">
                                <rect width="100%" height="100%" fill="white" />
                                <path d={getCropPath()} fill="black" />
                            </mask>
                        </defs>
                        <rect
                            width="100%"
                            height="100%"
                            fill="rgba(0,0,0,0.5)"
                            mask="url(#cropMask)"
                        />

                        {/* Crop region outline */}
                        <path
                            d={getCropPath()}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="2"
                            strokeDasharray="8 4"
                        />

                        {/* Edge lines */}
                        {corners.length === 4 && corners.map((corner, i) => {
                            const next = corners[(i + 1) % 4];
                            const c1 = imageToDisplay(corner.x, corner.y);
                            const c2 = imageToDisplay(next.x, next.y);
                            return (
                                <line
                                    key={`edge-${i}`}
                                    x1={c1.x}
                                    y1={c1.y}
                                    x2={c2.x}
                                    y2={c2.y}
                                    stroke="var(--accent)"
                                    strokeWidth="2"
                                />
                            );
                        })}
                    </svg>

                    {/* Draggable corner handles */}
                    {corners.map((corner, index) => {
                        const displayPos = imageToDisplay(corner.x, corner.y);
                        return (
                            <div
                                key={index}
                                className={`crop-corner-handle ${activeCorner === index ? 'active' : ''}`}
                                style={{
                                    left: displayPos.x,
                                    top: displayPos.y,
                                }}
                                onMouseDown={(e) => handlePointerDown(e, index)}
                                onTouchStart={(e) => handlePointerDown(e, index)}
                                role="button"
                                aria-label={`Drag ${cornerLabels[index]} corner`}
                                tabIndex={0}
                            >
                                <div className="corner-inner"></div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="crop-editor-actions">
                <button
                    className="btn btn-secondary"
                    onClick={onCancel}
                >
                    ✕ Cancel
                </button>
                <button
                    className="btn"
                    onClick={handleConfirm}
                >
                    ✓ Apply Crop
                </button>
            </div>
        </div>
    );
}
