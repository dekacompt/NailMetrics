import React from 'react';
import type { NailMeasurement } from '../hooks/useHandDetection';
import { cn } from '../lib/utils';

interface MeasurementSidebarProps {
  measurements: NailMeasurement[];
  pixelsPerMM?: number;
  highlightedIndex: number | null;
  onHighlight: (index: number | null) => void;
  imageSize: { width: number; height: number };
}

export const MeasurementSidebar: React.FC<MeasurementSidebarProps> = ({
  measurements,
  pixelsPerMM,
  highlightedIndex,
  onHighlight,
  imageSize
}) => {
  if (measurements.length === 0) return null;

  return (
    <div className="w-full lg:w-80 bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4 backdrop-blur-sm h-fit">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
         <h3 className="text-lg font-semibold text-white">
           Measurements
         </h3>
      </div>
      
      <div className="flex flex-col gap-2">
        {measurements.map((m, index) => {
           let widthMM = "---";
           let heightMM = "---";
           
           if (pixelsPerMM && imageSize.width > 0) {
               const naturalWidth = imageSize.width;
               const naturalHeight = imageSize.height;
               
               // Calculate real-world dimensions
               const trueW = m.boundingBox.width * naturalWidth;
               const trueH = m.boundingBox.height * naturalHeight;
               
               widthMM = (trueW / pixelsPerMM).toFixed(1);
               heightMM = (trueH / pixelsPerMM).toFixed(1);
           }
           
           return (
             <div 
               key={index}
               className={cn(
                 "p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group",
                 highlightedIndex === index 
                    ? "bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                    : "bg-neutral-800/50 border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600"
               )}
               onMouseEnter={() => onHighlight(index)}
               onMouseLeave={() => onHighlight(null)}
             >
               <div className="flex items-center gap-3">
                 <div className={cn(
                   "w-3 h-3 rounded-full",
                   highlightedIndex === index ? "bg-blue-400" : "bg-neutral-600 group-hover:bg-neutral-500"
                 )} />
                 <span className="font-medium text-neutral-200">{m.finger}</span>
               </div>
               
               <div className="text-right">
                  <div className="text-sm font-bold text-white">
                    <span className="text-xs text-neutral-500 mr-1">W:</span>
                    {widthMM} mm
                  </div>
                  <div className="text-xs text-neutral-400">
                     <span className="text-neutral-600 mr-1">H:</span>
                     {heightMM} mm
                  </div>
               </div>
             </div>
           );
        })}
      </div>
      
      {!pixelsPerMM && (
        <div className="text-xs text-yellow-500/80 bg-yellow-500/10 p-2 rounded mt-2">
           ⚠️ Dimensions are estimated. Use Coin Calibrate for accuracy.
        </div>
      )}
    </div>
  );
};
