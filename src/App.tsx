import { Camera, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ImageUploader } from './components/ImageUploader';
import { NailOverlay } from './components/NailOverlay';
import type { NailMeasurement } from './hooks/useHandDetection';
import { useHandDetection } from './hooks/useHandDetection';

import { MeasurementSidebar } from './components/MeasurementSidebar';

type AppMode = 'home' | 'camera' | 'upload' | 'result';

function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 }); 
  const containerRef = useRef<HTMLDivElement>(null); 
  
  const { detect, isLoading: isModelLoading, error: modelError } = useHandDetection();
  const [measurements, setMeasurements] = useState<NailMeasurement[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  
  // Auto-Estimation State (FOV Based)
  const [pixelsPerMM, setPixelsPerMM] = useState<number | undefined>(undefined);
  const [showCoinTool, setShowCoinTool] = useState(false);

  const handleCapture = (src: string) => {
    setImageSrc(src);
    setMode('result');
    analyzeImage(src);
  };

  // v4: Implicit Calibration (Anthropometric)
  // Assume Thumb Width is ~15mm to determine scale.
  // This ensures measurements are always in a "sane" range.
  useEffect(() => {
    // Only run implicit calibration if NO coin calibration is active/set
    if (showCoinTool) return;
    
    // Prevent overwriting manual calibration (if user just closed the tool)
    if (pixelsPerMM !== undefined) return;

    if (measurements.length === 0 || imageSize.width === 0) return;

    // Find Thumb
    const thumb = measurements.find(m => m.finger === 'Thumb');
    
    if (thumb) {
      const thumbWidthPx = thumb.width * imageSize.width;
      
      // Implicit Constant: Thumb is 15.0mm
      const ASSUMED_THUMB_WIDTH_MM = 15.0;
      
      const ratio = thumbWidthPx / ASSUMED_THUMB_WIDTH_MM;
      setPixelsPerMM(ratio);
    }
  }, [measurements, imageSize.width, showCoinTool]);

  const analyzeImage = async (src: string) => {
    setIsAnalyzing(true);
    setPixelsPerMM(undefined);
    setShowCoinTool(false); // Reset coin tool on new image
    
    const img = new Image();
    img.src = src;
    img.onload = async () => {
      setImageSize({ width: img.width, height: img.height });
      try {
        const result = await detect(img);
        setMeasurements(result.measurements);
      } catch (err) {
        console.error("Detection failed:", err);
      } finally {
        setIsAnalyzing(false);
      }
    };
  };

  const reset = () => {
    setImageSrc(null);
    setMeasurements([]);
    setMode('home');
    setPixelsPerMM(undefined);
    setShowCoinTool(false);
  };

  return (
    <div className="w-full h-full bg-neutral-950 text-white flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* Header */}
      <header className="w-full h-16 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-neutral-900 bg-neutral-950/50 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-100 to-purple-200">
            NailMetrics
          </h1>
        </div>
        
        {/* Controls (Visible in Result Mode) */}
        {mode === 'result' && !isAnalyzing && (
           <div className="flex items-center gap-2">
               <button 
                  onClick={reset}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition-all hover:text-white"
               >
                  Analyze New
               </button>
               <button
                  onClick={() => setShowCoinTool(!showCoinTool)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showCoinTool ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white'}`}
               >
                  {showCoinTool ? 'Done' : '🪙 Coin Calibrate'}
               </button>
           </div>
        )}
      </header>

      {/* Main Content Area - constrained to remaining height */}
      <main className="flex-1 w-full min-h-0 relative flex flex-col items-center overflow-hidden">
          
        {/* Error Banner */}
        {modelError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl backdrop-blur-sm">
            {modelError}
          </div>
        )}

        {/* Home Mode */}
        {mode === 'home' && (
          <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto">
             <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
               {/* Camera Card */}
               <button 
                 onClick={() => setMode('camera')}
                 disabled={isModelLoading}
                 className="group relative bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 rounded-3xl p-8 flex flex-col items-center text-center transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 overflow-hidden"
               >
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="w-20 h-20 rounded-2xl bg-neutral-800 group-hover:bg-blue-500/20 flex items-center justify-center mb-6 transition-colors shadow-inner">
                   <Camera className="w-10 h-10 text-neutral-400 group-hover:text-blue-400 transition-colors" />
                 </div>
                 <h2 className="text-2xl font-semibold text-neutral-200 mb-2">Take Photo</h2>
                 <p className="text-neutral-500 group-hover:text-neutral-400 transition-colors">
                   Use your camera
                 </p>
               </button>

               {/* Upload Card */}
               <button 
                 onClick={() => setMode('upload')}
                 disabled={isModelLoading}
                 className="group relative bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 rounded-3xl p-8 flex flex-col items-center text-center transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 overflow-hidden"
               >
                 <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="w-20 h-20 rounded-2xl bg-neutral-800 group-hover:bg-purple-500/20 flex items-center justify-center mb-6 transition-colors shadow-inner">
                   <Upload className="w-10 h-10 text-neutral-400 group-hover:text-purple-400 transition-colors" />
                 </div>
                 <h2 className="text-2xl font-semibold text-neutral-200 mb-2">Upload Image</h2>
                 <p className="text-neutral-500 group-hover:text-neutral-400 transition-colors">
                   From gallery
                 </p>
               </button>
             </div>
          </div>
        )}

        {/* Camera Mode */}
        {mode === 'camera' && (
           <div className="w-full h-full flex items-center justify-center">
               <CameraCapture 
                 onCapture={handleCapture} 
                 onClose={() => setMode('home')} 
               />
           </div>
        )}

        {/* Upload Mode */}
        {mode === 'upload' && (
           <div className="w-full h-full flex flex-col items-center justify-center p-4">
             <div className="w-full max-w-xl mb-8">
                <ImageUploader onUpload={handleCapture} />
             </div>
             <button 
               onClick={() => setMode('home')}
               className="text-neutral-400 hover:text-white transition-colors"
             >
               Cancel
             </button>
           </div>
        )}

        {/* Result Mode */}
        {mode === 'result' && imageSrc && (
           <div className="w-full h-full flex flex-col lg:flex-row items-stretch overflow-hidden">
             
             {isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                   <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                   <h3 className="text-xl font-medium text-blue-400">Analyzing Geometry...</h3>
                </div>
             ) : (
                <>
                  {/* Left: Image Canvas (Flexible) */}
                  <div className="flex-1 relative bg-black/50 overflow-hidden flex items-center justify-center p-4">
                     {/* The container for the image - constrain it to fit */}
                     <div 
                        ref={containerRef}
                        className="relative max-w-full max-h-full shadow-2xl overflow-hidden bg-black shrink-0 rounded-lg border border-neutral-800"
                        style={{ aspectRatio: imageSize.width && imageSize.height ? `${imageSize.width}/${imageSize.height}` : 'auto' }}
                     >
                        <NailOverlay 
                          imageSrc={imageSrc} 
                          measurements={measurements} 
                          onMeasurementsChange={setMeasurements}
                          highlightedIndex={highlightedIndex}
                          onHighlight={setHighlightedIndex}
                          pixelsPerMM={pixelsPerMM}
                          showCoinTool={showCoinTool}
                          onCalibrationChange={(pxPerMM_Screen) => {
                              if (containerRef.current && imageSize.width > 0) {
                                 // Now that CoinOverlay is INSIDE the transformed space (which matches Image Natural Space?),
                                 // Wait. The Transformed Space matches the "Unzoomed Display Space".
                                 // If Image Natural=4000, Display=500.
                                 // Coin=100 in Display Space (1/5).
                                 // Real Coin PX = 1/5 * 4000 = 800.
                                 // pxPerMM_Screen is 100 / 26 = 3.8.
                                 // We need 800 / 26 = 30.7.
                                 // So we STILL need to scale by (Natural / Display).
                                 // `containerRef.current.clientWidth` IS the Display Width.
                                 // So the existing logic holds!
                                 const renderWidth = containerRef.current.clientWidth;
                                 const scaleFactor = imageSize.width / renderWidth;
                                 const pxPerMM_Image = pxPerMM_Screen * scaleFactor;
                                 setPixelsPerMM(pxPerMM_Image);
                              } else {
                                 setPixelsPerMM(pxPerMM_Screen);
                              }
                           }}
                        />
                     </div>
                  </div>

                  {/* Right: Sidebar (Fixed Width on Desktop) */}
                  <div className="w-full lg:w-80 bg-neutral-950 border-t lg:border-t-0 lg:border-l border-neutral-800 h-1/3 lg:h-full shrink-0 overflow-y-auto p-4 z-10 shadow-xl">
                      <MeasurementSidebar 
                         measurements={measurements}
                         pixelsPerMM={pixelsPerMM}
                         highlightedIndex={highlightedIndex}
                         onHighlight={setHighlightedIndex}
                         imageSize={imageSize}
                      />
                  </div>
                </>
             )}
           </div>
        )}
      </main>

      {/* Footer (Only on Home?) */}
      {mode === 'home' && (
        <footer className="w-full py-4 border-t border-neutral-900 text-center text-neutral-600 text-xs shrink-0">
          <p>Powered by MediaPipe Hands & React</p>
        </footer>
      )}
    </div>
  );
}

export default App;
