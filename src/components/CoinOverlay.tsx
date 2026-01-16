import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface CoinOverlayProps {
  onCalibrationChange: (pixelsPerMM: number) => void;
  isVisible: boolean;
  scale?: number;
}

// 10 NTD Coin Diameter = 26mm
const COIN_DIAMETER_MM = 26.0;

export function CoinOverlay({ onCalibrationChange, isVisible, scale = 1 }: CoinOverlayProps) {
  // Default size: roughly 100px
  const [diameter, setDiameter] = useState(100);
  // Start at 0,0 but hide until centered? Or just center on mount.
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Center the coin on mount based on actual container size
  useEffect(() => {
    if (isVisible && overlayRef.current && !initialized) {
      const { clientWidth, clientHeight } = overlayRef.current;
      setPosition({
        x: clientWidth / 2 - diameter / 2,
        y: clientHeight / 2 - diameter / 2
      });
      setInitialized(true);
    }
  }, [isVisible, initialized, diameter]);

  useEffect(() => {
    // Initial calibration
    if (isVisible) {
      onCalibrationChange(diameter / COIN_DIAMETER_MM);
    }
  }, [diameter, isVisible]);

  if (!isVisible) return null;

  const handleMouseDown = (e: React.MouseEvent, mode: 'drag' | 'resize') => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent panning correctly
    if (mode === 'drag') setIsDragging(true);
    if (mode === 'resize') setIsResizing(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && !isResizing) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.x) / scale;
    const dy = (e.clientY - dragStartRef.current.y) / scale;

    if (isDragging) {
      setPosition(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
    } else if (isResizing) {
      // Simple resize logic: dragging right/down increases size
      const delta = Math.max(dx, dy); 
      setDiameter(prev => Math.max(20, prev + delta));
    }

    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  return (
    <div 
      ref={overlayRef}
      className={cn(
        "absolute inset-0 pointer-events-auto overflow-hidden text-white transition-opacity duration-300",
        !initialized ? "opacity-0" : "opacity-100"
      )}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm border border-white/10 z-50">
        <p className="font-bold text-yellow-400">🪙 Coin Calibration Mode</p>
        <p className="text-neutral-300">Drag the circle to match your 10 NTD coin.</p>
      </div>

      <div 
        className={cn(
          "absolute rounded-full border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] cursor-move flex items-center justify-center group",
          isDragging && "cursor-grabbing border-yellow-300",
          isResizing && "cursor-nwse-resize"
        )}
        style={{
          width: diameter,
          height: diameter,
          left: position.x,
          top: position.y,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'drag')}
      >
        {/* Safe Area / Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-full h-px bg-yellow-400/50" />
          <div className="h-full w-px bg-yellow-400/50 absolute" />
        </div>
        
        {/* Resize Handle (Bottom Right) */}
        <div 
           className="absolute bottom-1 right-1 p-1 bg-yellow-500 rounded-full cursor-nwse-resize hover:scale-125 transition-transform"
           onMouseDown={(e) => {
             e.stopPropagation();
             handleMouseDown(e, 'resize');
           }}
        >
          <div className="w-2 h-2 bg-black rounded-full" />
        </div>

        {/* Info Label */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/70 px-2 py-0.5 rounded text-xs font-mono">
           {COIN_DIAMETER_MM} mm
        </div>
      </div>
    </div>
  );
}
