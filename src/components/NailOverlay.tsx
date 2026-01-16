import React, { useRef, useState } from 'react';
import type { NailMeasurement } from '../hooks/useHandDetection';
import { cn } from '../lib/utils';
import { CoinOverlay } from './CoinOverlay';

interface NailOverlayProps {
  imageSrc: string;
  measurements: NailMeasurement[];
  onMeasurementsChange: (measurements: NailMeasurement[]) => void;
  highlightedIndex?: number | null;
  onHighlight?: (index: number | null) => void;
  pixelsPerMM?: number;
  showCoinTool: boolean;
  onCalibrationChange: (pixelsPerMM: number) => void;
}

export const NailOverlay: React.FC<NailOverlayProps> = ({ 
  imageSrc, 
  measurements, 
  onMeasurementsChange,
  highlightedIndex,
  onHighlight,
  showCoinTool,
  onCalibrationChange
}) => {
  // Zoom and Pan State
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 }); // Screen coordinates
  // Store initial transform when panning starts
  const panStartTransformRef = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  // interactionMode can be 'drag', 'resize-n', 'resize-s', 'resize-e', 'resize-w'
  const [interactionMode, setInteractionMode] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialMeasurementRef = useRef<NailMeasurement | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Zoom Sensitivity
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.5, transform.scale * (1 + scaleAmount)), 5);
    
    // Zoom toward center (simplified) or mouse pointer (better, but more complex math)
    // For now, simple center zoom, as it's less prone to jumping if math is off.
    // Ideally: P_new = P_mouse + (P_old - P_mouse) * (scale_new / scale_old)
    
    setTransform(prev => ({
      ...prev,
      scale: newScale
    }));
  };

  const handleMouseDown = (e: React.MouseEvent, index: number | null, mode: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (index === null) {
       // Background Click -> Start Pan
       setIsPanning(true);
       panStartRef.current = { x: e.clientX, y: e.clientY };
       panStartTransformRef.current = { x: transform.x, y: transform.y };
       return;
    }

    setActiveId(index);
    setInteractionMode(mode);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialMeasurementRef.current = { ...measurements[index] };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Handle Panning
    if (isPanning) {
       const dx = e.clientX - panStartRef.current.x;
       const dy = e.clientY - panStartRef.current.y;
       setTransform({
          ...transform,
          x: panStartTransformRef.current.x + dx,
          y: panStartTransformRef.current.y + dy
       });
       return;
    }

    // 2. Handle Object Dragging / Resizing / Rotating
    if (activeId === null || !interactionMode || !containerRef.current || !initialMeasurementRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect(); 
    
    // For Rotation: We need center of the box in global screen coordinates
    const initialM = initialMeasurementRef.current;
    
    // Current Scale is irrelevant for rotation math if we work in screen space
    // Center of the box in Normalized Space (0-1)
    const cxNorm = initialM.boundingBox.x;
    const cyNorm = initialM.boundingBox.y;
    
    // Center in Screen Pixels (Relative to Container TopLeft)
    // Container Rect includes the transform? Yes.
    // Wait, getBoundingClientRect returns the Viewport Coordinates.
    // Container is the DIV with `transform`.
    // Its `left, top` relate to viewport.
    
    // We can just calculate angle from Mouse to Box Center.
    // Box Center needs to be calculated in Screen Pixels.
    // We know m.x is relative to the IMAGE inside.
    // The Image is inside `container`. 
    // Is `container` the wrapper or the transformed element?
    // ref={containerRef} is on the Transformed Div `div style={{ transform... }}`.
    // So `rect` IS the transformed, scaled, moved box on screen.
    // The Image sits inside it and fills it.
    // So px = rect.left + cxNorm * rect.width
    // py = rect.top + cyNorm * rect.height
    
    const centerX = rect.left + cxNorm * rect.width;
    const centerY = rect.top + cyNorm * rect.height;
    
    const dxPx = e.clientX - dragStartRef.current.x;
    const dyPx = e.clientY - dragStartRef.current.y;
    
    const newMeasurements = [...measurements];
    
    if (interactionMode === 'rotate') {
       // Vector from Center to Mouse
       const vecX = e.clientX - centerX;
       const vecY = e.clientY - centerY;
       
       // Current Angle
       const currentAngle = Math.atan2(vecY, vecX);
       
       // Initial Mouse Angle (From Start of Drag)
       const startVecX = dragStartRef.current.x - centerX;
       const startVecY = dragStartRef.current.y - centerY;
       const startAngle = Math.atan2(startVecY, startVecX);
       
       // Apply Rotation Delta
       // New Rotation = Initial Rotation + (Current - Start)
       const deltaRotation = currentAngle - startAngle;
       
       newMeasurements[activeId] = {
         ...initialM,
         boundingBox: {
           ...initialM.boundingBox,
           rotation: initialM.boundingBox.rotation + deltaRotation
         }
       };

    } else if (interactionMode === 'drag') {
       // Normalized delta
       const dx = dxPx / rect.width;
       const dy = dyPx / rect.height;
       
       newMeasurements[activeId] = {
         ...initialM,
         boundingBox: {
           ...initialM.boundingBox,
           x: initialM.boundingBox.x + dx,
           y: initialM.boundingBox.y + dy
         }
       };
    } else if (interactionMode.startsWith('resize')) {
       // ... existing resize logic ...
       const dx = dxPx / rect.width;
       const dy = dyPx / rect.height;
       
       const rotation = initialM.boundingBox.rotation;
       const cos = Math.cos(-rotation);
       const sin = Math.sin(-rotation);
       
       const localDx = dx * cos - dy * sin;
       const localDy = dx * sin + dy * cos;
       
       let newW = initialM.boundingBox.width;
       let newH = initialM.boundingBox.height;
       let shiftLocalX = 0;
       let shiftLocalY = 0;

       switch (interactionMode) {
          case 'resize-e': 
             newW = Math.max(0.01, initialM.boundingBox.width + localDx);
             shiftLocalX = localDx / 2;
             break;
          case 'resize-w': 
             newW = Math.max(0.01, initialM.boundingBox.width - localDx);
             shiftLocalX = localDx / 2; 
             break;
          case 'resize-s': 
             newH = Math.max(0.01, initialM.boundingBox.height + localDy);
             shiftLocalY = localDy / 2;
             break;
          case 'resize-n': 
             newH = Math.max(0.01, initialM.boundingBox.height - localDy);
             shiftLocalY = localDy / 2;
             break;
       }

       const globalShiftX = shiftLocalX * Math.cos(rotation) - shiftLocalY * Math.sin(rotation);
       const globalShiftY = shiftLocalX * Math.sin(rotation) + shiftLocalY * Math.cos(rotation);

       newMeasurements[activeId] = {
         ...initialM,
         boundingBox: {
           ...initialM.boundingBox,
           width: newW,
           height: newH,
           x: initialM.boundingBox.x + globalShiftX,
           y: initialM.boundingBox.y + globalShiftY
         }
       };
    }
    
  };

  // Pinch Zoom Refs
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);

  // Helper for Pinch
  const getPinchDist = (e: React.TouchEvent) => {
     if (e.touches.length < 2) return 0;
     const t1 = e.touches[0];
     const t2 = e.touches[1];
     return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  };

  // Touch Logic mirroring Mouse Logic
  const handleTouchStart = (e: React.TouchEvent, index: number | null, mode: string) => {
    e.stopPropagation();
    
    // Handle Pinch Start (2 fingers)
    if (e.touches.length === 2) {
       const dist = getPinchDist(e);
       pinchStartDistRef.current = dist;
       pinchStartScaleRef.current = transform.scale;
       
       // Cancel other interactions
       setIsPanning(false);
       setActiveId(null);
       setInteractionMode(null);
       return;
    }

    const touch = e.touches[0];
    
    if (index === null) {
       // Pan Start
       setIsPanning(true);
       panStartRef.current = { x: touch.clientX, y: touch.clientY };
       panStartTransformRef.current = { x: transform.x, y: transform.y };
       return;
    }

    setActiveId(index);
    setInteractionMode(mode);
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    initialMeasurementRef.current = { ...measurements[index] };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault(); // Prevent scrolling

    // 1. Handle Pinch Zoom (High Priority)
    if (e.touches.length === 2) {
       const dist = getPinchDist(e);
       if (pinchStartDistRef.current > 0 && dist > 0) {
          const scaleRatio = dist / pinchStartDistRef.current;
          const newScale = Math.min(Math.max(0.5, pinchStartScaleRef.current * scaleRatio), 5);
          
          setTransform(prev => ({
             ...prev,
             scale: newScale
          }));
       }
       return;
    }

    const touch = e.touches[0];

    // 2. Handle Panning
    if (isPanning) {
       const dx = touch.clientX - panStartRef.current.x;
       const dy = touch.clientY - panStartRef.current.y;
       setTransform({
          ...transform,
          x: panStartTransformRef.current.x + dx,
          y: panStartTransformRef.current.y + dy
       });
       // Don't return, as we strictly handled panning logic? 
       // Wait, if Panning, we definitely don't want to drag objects.
       return;
    }

    // 3. Handle Object Interactions
    if (activeId === null || !interactionMode || !containerRef.current || !initialMeasurementRef.current) return;
    
    // ... rest of drag/resize logic ...
    const container = containerRef.current;
    const rect = container.getBoundingClientRect(); 
    
    const initialM = initialMeasurementRef.current;
    const cxNorm = initialM.boundingBox.x;
    const cyNorm = initialM.boundingBox.y;
    
    const centerX = rect.left + cxNorm * rect.width;
    const centerY = rect.top + cyNorm * rect.height;
    
    const dxPx = touch.clientX - dragStartRef.current.x;
    const dyPx = touch.clientY - dragStartRef.current.y;
    
    const newMeasurements = [...measurements];
    
    if (interactionMode === 'rotate') {
       const vecX = touch.clientX - centerX;
       const vecY = touch.clientY - centerY;
       const currentAngle = Math.atan2(vecY, vecX);
       
       const startVecX = dragStartRef.current.x - centerX;
       const startVecY = dragStartRef.current.y - centerY;
       const startAngle = Math.atan2(startVecY, startVecX);
       
       const deltaRotation = currentAngle - startAngle;
       
       newMeasurements[activeId] = {
         ...initialM,
         boundingBox: {
           ...initialM.boundingBox,
           rotation: initialM.boundingBox.rotation + deltaRotation
         }
       };

    } else if (interactionMode === 'drag') {
       const dx = dxPx / rect.width;
       const dy = dyPx / rect.height;
       
       newMeasurements[activeId] = {
         ...initialM,
         boundingBox: {
           ...initialM.boundingBox,
           x: initialM.boundingBox.x + dx,
           y: initialM.boundingBox.y + dy
         }
       };
    } else if (interactionMode.startsWith('resize')) {
       const dx = dxPx / rect.width;
       const dy = dyPx / rect.height;
       
       const rotation = initialM.boundingBox.rotation;
       const cos = Math.cos(-rotation);
       const sin = Math.sin(-rotation);
       
       const localDx = dx * cos - dy * sin;
       const localDy = dx * sin + dy * cos;
       
       let newW = initialM.boundingBox.width;
       let newH = initialM.boundingBox.height;
       let shiftLocalX = 0;
       let shiftLocalY = 0;

       switch (interactionMode) {
          case 'resize-e': 
             newW = Math.max(0.01, initialM.boundingBox.width + localDx);
             shiftLocalX = localDx / 2; break;
          case 'resize-w': 
             newW = Math.max(0.01, initialM.boundingBox.width - localDx);
             shiftLocalX = localDx / 2; break;
          case 'resize-s': 
             newH = Math.max(0.01, initialM.boundingBox.height + localDy);
             shiftLocalY = localDy / 2; break;
          case 'resize-n': 
             newH = Math.max(0.01, initialM.boundingBox.height - localDy);
             shiftLocalY = localDy / 2; break;
       }

       const globalShiftX = shiftLocalX * Math.cos(rotation) - shiftLocalY * Math.sin(rotation);
       const globalShiftY = shiftLocalX * Math.sin(rotation) + shiftLocalY * Math.cos(rotation);

       newMeasurements[activeId] = {
         ...initialM,
         boundingBox: {
           ...initialM.boundingBox,
           width: newW,
           height: newH,
           x: initialM.boundingBox.x + globalShiftX,
           y: initialM.boundingBox.y + globalShiftY
         }
       };
    }
    
    onMeasurementsChange(newMeasurements);
  };


  const handleTouchEnd = () => {
    setIsPanning(false);
    setActiveId(null);
    setInteractionMode(null);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setActiveId(null);
    setInteractionMode(null);
  };

  return (
    <div 
      className="relative w-full h-full min-h-[500px] overflow-hidden bg-neutral-900/50 rounded-xl cursor-grab active:cursor-grabbing border border-neutral-800 touch-none"
      onWheel={handleWheel}
      onMouseDown={(e) => handleMouseDown(e, null, 'pan')}
      onTouchStart={(e) => handleTouchStart(e, null, 'pan')}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      onMouseLeave={handleMouseUp}
    > 
      {/* Transformed Container */}
      <div 
        ref={containerRef}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
          transition: isPanning || activeId !== null ? 'none' : 'transform 0.1s ease-out'
        }}
        className="w-full h-full relative flex items-center justify-center transform-gpu will-change-transform"
      >
        <img 
          ref={imageRef}
          src={imageSrc} 
          alt="Analysis Target" 
          className="max-w-full max-h-full object-contain pointer-events-none select-none"
          draggable={false}
        />
        
        <CoinOverlay 
            isVisible={showCoinTool}
            scale={transform.scale}
            onCalibrationChange={onCalibrationChange}
        />
        
        {measurements.map((m, index) => {
          const { x, y, width, height, rotation } = m.boundingBox;
          const left = x * 100;
          const top = y * 100;
          const w = width * 100;
          const h = height * 100;
          
          const isActive = activeId === index || highlightedIndex === index;
          
          return (
            <div
              key={index}
              className="absolute group"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${w}%`,
                height: `${h}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}rad)`,
              }}
            >
               {/* The Box */}
               <div 
                 className={cn(
                   "w-full h-full border-2 cursor-move transition-colors relative",
                   // Default Style
                   "border-green-400 bg-green-400/10 hover:bg-green-400/20",
                   // Active/Highlighted Style
                   isActive ? "border-yellow-400 bg-yellow-400/20 z-50" : ""
                 )}
                 onMouseDown={(e) => handleMouseDown(e, index, 'drag')}
                 onTouchStart={(e) => handleTouchStart(e, index, 'drag')}
                 onMouseEnter={() => onHighlight?.(index)}
                 onMouseLeave={() => onHighlight?.(null)}
               >
                  {/* Edges - Scale Invariant Handles? */}
                  
                  {/* Top (N) */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-4 -mt-2 cursor-n-resize group/handle flex justify-center items-center z-10"
                    onMouseDown={(e) => handleMouseDown(e, index, 'resize-n')}
                    onTouchStart={(e) => handleTouchStart(e, index, 'resize-n')}
                  >
                     <div className="w-8 h-1 bg-white/80 rounded-full group-hover/handle:bg-yellow-400 transition-colors shadow-sm" />
                  </div>
  
                  {/* Bottom (S) */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-4 -mb-2 cursor-s-resize group/handle flex justify-center items-center z-10"
                    onMouseDown={(e) => handleMouseDown(e, index, 'resize-s')}
                    onTouchStart={(e) => handleTouchStart(e, index, 'resize-s')}
                  >
                     <div className="w-8 h-1 bg-white/80 rounded-full group-hover/handle:bg-yellow-400 transition-colors shadow-sm" />
                  </div>
  
                  {/* Left (W) */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 w-4 -ml-2 cursor-w-resize group/handle flex flex-col justify-center items-center z-10"
                    onMouseDown={(e) => handleMouseDown(e, index, 'resize-w')}
                    onTouchStart={(e) => handleTouchStart(e, index, 'resize-w')}
                  >
                     <div className="h-8 w-1 bg-white/80 rounded-full group-hover/handle:bg-yellow-400 transition-colors shadow-sm" />
                  </div>
  
                  {/* Right (E) */}
                  <div 
                    className="absolute top-0 bottom-0 right-0 w-4 -mr-2 cursor-e-resize group/handle flex flex-col justify-center items-center z-10"
                    onMouseDown={(e) => handleMouseDown(e, index, 'resize-e')}
                    onTouchStart={(e) => handleTouchStart(e, index, 'resize-e')}
                  >
                     <div className="h-8 w-1 bg-white/80 rounded-full group-hover/handle:bg-yellow-400 transition-colors shadow-sm" />
                  </div>

                  {/* Rotate Handle */}
                  <div 
                     className="absolute -top-8 left-1/2 -ml-0.5 w-1 h-8 bg-white/50 z-10 group/rotate"
                     onMouseDown={(e) => handleMouseDown(e, index, 'rotate')}
                     onTouchStart={(e) => handleTouchStart(e, index, 'rotate')}
                  >
                     <div className="absolute top-0 left-1/2 -ml-1.5 -mt-1.5 w-3 h-3 bg-white rounded-full border border-neutral-500 shadow-md cursor-grab group-active/rotate:cursor-grabbing hover:bg-yellow-400" />
                  </div>
               </div>
               
               {/* Labels Removed as requested. They will move to sidebar. */}
            </div>
          );
        })}
      </div>
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-50">
        <button 
           className="p-2 bg-neutral-800/80 backdrop-blur text-white rounded-lg hover:bg-neutral-700 border border-neutral-700"
           onClick={(e) => { e.stopPropagation(); setTransform(t => ({ ...t, scale: Math.max(0.5, t.scale - 0.5) })); }}
        >
          -
        </button>
        <span className="p-2 bg-neutral-900/80 text-xs flex items-center rounded-lg border border-neutral-800 tabular-nums">
           {Math.round(transform.scale * 100)}%
        </span>
        <button 
           className="p-2 bg-neutral-800/80 backdrop-blur text-white rounded-lg hover:bg-neutral-700 border border-neutral-700"
           onClick={(e) => { e.stopPropagation(); setTransform(t => ({ ...t, scale: Math.min(5, t.scale + 0.5) })); }}
        >
          +
        </button>
        <button 
           className="p-2 bg-neutral-800/80 backdrop-blur text-white rounded-lg hover:bg-neutral-700 border border-neutral-700 text-xs"
           onClick={(e) => { e.stopPropagation(); setTransform({ scale: 1, x: 0, y: 0 }); }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};
