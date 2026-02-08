import { useState, useRef, useEffect, useCallback } from 'react';
import { loadImage, getDefaultCorners } from '../utils/ImageProcessor';

/**
 * DocumentCropEditor - Full-screen overlay for manual corner selection
 * Features: corner handles, edge handles, and magnifier bubble for touch devices.
 */
export default function DocumentCropEditor({ imageFile, onConfirm, onCancel }) {
    const [image, setImage] = useState(null);
    const [corners, setCorners] = useState([]);
    const [activeHandle, setActiveHandle] = useState(null); // { type: 'corner'|'edge', index: number }
    const [pointerPos, setPointerPos] = useState(null); // Current pointer position in image coords
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0, scale: 1 });
    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const canvasRef = useRef(null); // For magnifier

    // Magnifier settings
    const MAGNIFIER_SIZE = 120;
    const MAGNIFIER_ZOOM = 0.3; // Zoomed out to show more context
    const MAGNIFIER_OFFSET = 80; // Distance above finger
    const SMOOTHING = 0.4; // Smoothing factor for corner movement (0-1, lower = smoother)

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

    // Draw magnifier content
    useEffect(() => {
        if (!activeHandle || !pointerPos || !image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);

        // Calculate source region (centered on pointer position)
        const sourceSize = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
        const sx = pointerPos.x - sourceSize / 2;
        const sy = pointerPos.y - sourceSize / 2;

        // Draw zoomed image region
        ctx.save();
        ctx.beginPath();
        ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        ctx.drawImage(
            image,
            sx, sy, sourceSize, sourceSize,
            0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE
        );

        // Draw crosshair
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(MAGNIFIER_SIZE / 2 - 15, MAGNIFIER_SIZE / 2);
        ctx.lineTo(MAGNIFIER_SIZE / 2 + 15, MAGNIFIER_SIZE / 2);
        ctx.moveTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 15);
        ctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 + 15);
        ctx.stroke();

        ctx.restore();

        // Draw border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();
    }, [activeHandle, pointerPos, image]);

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

    // Get edge midpoint
    const getEdgeMidpoint = useCallback((edgeIndex) => {
        if (corners.length !== 4) return { x: 0, y: 0 };
        const c1 = corners[edgeIndex];
        const c2 = corners[(edgeIndex + 1) % 4];
        return {
            x: (c1.x + c2.x) / 2,
            y: (c1.y + c2.y) / 2
        };
    }, [corners]);

    // Handle pointer start for corners
    const handleCornerDown = (e, cornerIndex) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveHandle({ type: 'corner', index: cornerIndex });

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setPointerPos(displayToImage(clientX, clientY));
    };

    // Handle pointer start for edges
    const handleEdgeDown = (e, edgeIndex) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveHandle({ type: 'edge', index: edgeIndex });

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setPointerPos(displayToImage(clientX, clientY));
    };

    // Handle pointer move
    const handlePointerMove = useCallback((e) => {
        if (!activeHandle) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const imgCoords = displayToImage(clientX, clientY);
        setPointerPos(imgCoords);

        // Clamp to image bounds
        const clampedX = Math.max(0, Math.min(image.naturalWidth, imgCoords.x));
        const clampedY = Math.max(0, Math.min(image.naturalHeight, imgCoords.y));

        if (activeHandle.type === 'corner') {
            // Move single corner with smoothing
            setCorners((prev) => {
                const newCorners = [...prev];
                const current = prev[activeHandle.index];
                // Interpolate between current position and target for smooth movement
                newCorners[activeHandle.index] = {
                    x: current.x + (clampedX - current.x) * SMOOTHING,
                    y: current.y + (clampedY - current.y) * SMOOTHING
                };
                return newCorners;
            });
        } else if (activeHandle.type === 'edge') {
            // Move both corners of the edge
            setCorners((prev) => {
                const newCorners = [...prev];
                const edgeIndex = activeHandle.index;
                const c1Index = edgeIndex;
                const c2Index = (edgeIndex + 1) % 4;

                // Calculate delta from midpoint
                const midpoint = getEdgeMidpoint(edgeIndex);
                const deltaX = clampedX - midpoint.x;
                const deltaY = clampedY - midpoint.y;

                // For horizontal edges (top=0, bottom=2), only move Y
                // For vertical edges (right=1, left=3), only move X
                if (edgeIndex === 0 || edgeIndex === 2) {
                    // Top or bottom edge - move vertically
                    newCorners[c1Index] = {
                        x: prev[c1Index].x,
                        y: Math.max(0, Math.min(image.naturalHeight, prev[c1Index].y + deltaY))
                    };
                    newCorners[c2Index] = {
                        x: prev[c2Index].x,
                        y: Math.max(0, Math.min(image.naturalHeight, prev[c2Index].y + deltaY))
                    };
                } else {
                    // Left or right edge - move horizontally
                    newCorners[c1Index] = {
                        x: Math.max(0, Math.min(image.naturalWidth, prev[c1Index].x + deltaX)),
                        y: prev[c1Index].y
                    };
                    newCorners[c2Index] = {
                        x: Math.max(0, Math.min(image.naturalWidth, prev[c2Index].x + deltaX)),
                        y: prev[c2Index].y
                    };
                }

                return newCorners;
            });
        }
    }, [activeHandle, displayToImage, image, getEdgeMidpoint]);

    // Handle pointer end
    const handlePointerUp = useCallback(() => {
        setActiveHandle(null);
        setPointerPos(null);
    }, []);

    // Add global event listeners for dragging
    useEffect(() => {
        if (activeHandle !== null) {
            window.addEventListener('mousemove', handlePointerMove);
            window.addEventListener('mouseup', handlePointerUp);
            window.addEventListener('touchmove', handlePointerMove, { passive: false });
            window.addEventListener('touchend', handlePointerUp);

            return () => {
                window.removeEventListener('mousemove', handlePointerMove);
                window.removeEventListener('mouseup', handlePointerUp);
                window.removeEventListener('touchmove', handlePointerMove);
                window.removeEventListener('touchend', handlePointerUp);
            };
        }
    }, [activeHandle, handlePointerMove, handlePointerUp]);

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

    // Calculate magnifier position (offset above the touch point)
    const getMagnifierPosition = () => {
        if (!pointerPos || !activeHandle) return null;

        const displayPos = imageToDisplay(pointerPos.x, pointerPos.y);
        let top = displayPos.y - MAGNIFIER_OFFSET - MAGNIFIER_SIZE;
        let left = displayPos.x - MAGNIFIER_SIZE / 2;

        // Keep magnifier within bounds
        if (top < 0) {
            top = displayPos.y + MAGNIFIER_OFFSET; // Show below instead
        }
        left = Math.max(0, Math.min(displaySize.width - MAGNIFIER_SIZE, left));

        return { top, left };
    };

    // Labels
    const cornerLabels = ['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left'];
    const edgeLabels = ['Top', 'Right', 'Bottom', 'Left'];

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

    const magnifierPos = getMagnifierPosition();

    return (
        <div className="crop-editor-overlay">
            <div className="crop-editor-header">
                <h2>Adjust Corners</h2>
                <p>Drag corners or edges to align with your document</p>
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

                    {/* Edge handles (midpoints) */}
                    {corners.length === 4 && [0, 1, 2, 3].map((edgeIndex) => {
                        const midpoint = getEdgeMidpoint(edgeIndex);
                        const displayPos = imageToDisplay(midpoint.x, midpoint.y);
                        const isVertical = edgeIndex === 1 || edgeIndex === 3;

                        return (
                            <div
                                key={`edge-handle-${edgeIndex}`}
                                className={`crop-edge-handle ${isVertical ? 'vertical' : 'horizontal'} ${activeHandle?.type === 'edge' && activeHandle?.index === edgeIndex ? 'active' : ''
                                    }`}
                                style={{
                                    left: displayPos.x,
                                    top: displayPos.y,
                                }}
                                onMouseDown={(e) => handleEdgeDown(e, edgeIndex)}
                                onTouchStart={(e) => handleEdgeDown(e, edgeIndex)}
                                role="button"
                                aria-label={`Drag ${edgeLabels[edgeIndex]} edge`}
                                tabIndex={0}
                            >
                                <div className="edge-inner"></div>
                            </div>
                        );
                    })}

                    {/* Corner handles */}
                    {corners.map((corner, index) => {
                        const displayPos = imageToDisplay(corner.x, corner.y);
                        return (
                            <div
                                key={index}
                                className={`crop-corner-handle ${activeHandle?.type === 'corner' && activeHandle?.index === index ? 'active' : ''
                                    }`}
                                style={{
                                    left: displayPos.x,
                                    top: displayPos.y,
                                }}
                                onMouseDown={(e) => handleCornerDown(e, index)}
                                onTouchStart={(e) => handleCornerDown(e, index)}
                                role="button"
                                aria-label={`Drag ${cornerLabels[index]} corner`}
                                tabIndex={0}
                            >
                                <div className="corner-inner"></div>
                            </div>
                        );
                    })}

                    {/* Magnifier bubble */}
                    {magnifierPos && (
                        <div
                            className="crop-magnifier"
                            style={{
                                left: magnifierPos.left,
                                top: magnifierPos.top,
                                width: MAGNIFIER_SIZE,
                                height: MAGNIFIER_SIZE
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                width={MAGNIFIER_SIZE}
                                height={MAGNIFIER_SIZE}
                            />
                        </div>
                    )}
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
