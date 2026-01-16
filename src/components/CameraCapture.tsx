import { RefreshCw, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { cn } from '../lib/utils';

interface CameraCaptureProps {
  onCapture: (imageSrc: string) => void;
  onClose: () => void;
}

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "environment" // Use back camera on mobile if available
};

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-neutral-800/50 rounded-full text-white hover:bg-neutral-700 transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative w-full h-full flex items-center justify-center bg-black">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="w-full h-full object-cover md:object-contain"
          onUserMedia={() => setIsCameraReady(true)}
          onUserMediaError={(err) => console.error("Camera Error:", err)}
        />
        
        {!isCameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-neutral-400">
             <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span>Accessing Camera...</span>
             </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center pb-4 px-4 bg-gradient-to-t from-black/80 to-transparent pt-12">
        <button
          onClick={capture}
          disabled={!isCameraReady}
          className={cn(
            "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all transform active:scale-95 shadow-lg",
             isCameraReady ? "bg-transparent hover:bg-white/20" : "opacity-50 cursor-not-allowed border-neutral-500"
          )}
        >
          <div className="w-16 h-16 rounded-full bg-white transition-opacity hover:opacity-90" />
        </button>
      </div>
    </div>
  );
};
