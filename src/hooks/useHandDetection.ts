import { FilesetResolver, HandLandmarker, type HandLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useState } from 'react';

export interface NailMeasurement {
  finger: string;
  width: number;
  length: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
}

export interface DetectionResult {
  measurements: NailMeasurement[];
  landmarks: NormalizedLandmark[][];
}

const MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export const useHandDetection = () => {
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: "GPU"
          },
          runningMode: "IMAGE",
          numHands: 2
        });
        setLandmarker(handLandmarker);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load MediaPipe HandLandmarker:", err);
        setError("Failed to load detection model. Please check your connection.");
        setIsLoading(false);
      }
    };

    initLandmarker();
  }, []);

  const estimateNailBounds = (landmarks: NormalizedLandmark[]): NailMeasurement[] => {
    // Finger indices in MediaPipe Hands:
    // Thumb: 1-4 (Tip: 4, IP: 3)
    // Index: 5-8 (Tip: 8, DIP: 7)
    // Middle: 9-12 (Tip: 12, DIP: 11)
    // Ring: 13-16 (Tip: 16, DIP: 15)
    // Pinky: 17-20 (Tip: 20, DIP: 19)
    
    // Heuristic: Nail occupies the distal portion of the distal phalanx.
    // Length: Estimation based on distance between DIP/IP joint and Tip.
    // Width: Estimation based on assumed ratio or local width heuristic.
    
    // 4. Heuristic for Nail Bounding Box
    // v4 Logic: Visual-Distal Scaling
    // - Length: Based on Tip-DIP segment length (visual length).
    // - Width: Derived from constant aspect ratio (Nails are roughly square).
    // - Position: Anchored to Tip.

    const fingers = [
      // Thumb: Tip(4) -> IP(3) -> MCP(2). 
      // Wide nail (ratio > 1.0).
      { name: 'Thumb', tip: 4, dip: 3, pip: 2, aspectRatio: 1.1, lengthRatio: 0.6 },
      
      // Others: Tip -> DIP -> PIP.
      // Nails are often roughly square or slightly tall.
      // Resetting shift to 0.5 (anchor at flesh tip).
      // Using Tip-PIP for rotation stability.
      { name: 'Index', tip: 8, dip: 7, pip: 6, aspectRatio: 0.95, lengthRatio: 0.6 },
      { name: 'Middle', tip: 12, dip: 11, pip: 10, aspectRatio: 0.95, lengthRatio: 0.6 },
      { name: 'Ring', tip: 16, dip: 15, pip: 14, aspectRatio: 0.9, lengthRatio: 0.6 },
      { name: 'Pinky', tip: 20, dip: 19, pip: 18, aspectRatio: 0.9, lengthRatio: 0.6 },
    ];

    return fingers.map(finger => {
      const tip = landmarks[finger.tip];
      const dip = landmarks[finger.dip]; 

      
      // 1. Calculate Phalanx Length (Tip -> DIP/IP)
      const dxDistal = dip.x - tip.x;
      const dyDistal = dip.y - tip.y;
      const distalLength = Math.sqrt(dxDistal * dxDistal + dyDistal * dyDistal);
      
      // 2. Orientation: Revert to Tip -> DIP (Distal Phalanx Axis)
      // This is more accurate for the nail itself, even if finger is bent.
      const fingerAngle = Math.atan2(dyDistal, dxDistal);
      const rotation = fingerAngle - Math.PI / 2;

      // 3. Dimensions: MAXIMIZE coverage
      // User feedback suggests boxes are constantly too small.
      // Nail often covers almost the entire visible distal segment width.
      
      const lengthR = finger.name === 'Thumb' ? 0.7 : 0.85;
      const aspectR = finger.name === 'Thumb' ? 1.2 : 1.0;
      
      const nailLength = distalLength * lengthR;
      const nailWidth = nailLength * aspectR;

      // 4. Position: Shift closer to tip
      // Tip -> DIP vector points "Inwards".
      // Previous 0.4/0.5 shift placed the "Top" of the box at the Tip.
      // But for long nails (extensions), the nail extends OUTWARDS from the tip.
      // User images show the target box is much further "Up" (distal).
      // Setting shift to 0.0 (or very small) centers the box ON the Tip landmark.
      // This means the box extends 50% "Out" (Air) and 50% "In" (Flesh).
      // This better captures long nails.
      
      const nx = dxDistal / distalLength;
      const ny = dyDistal / distalLength;
      
      // Shift Ratio 0.1: Slightly inwards from tip center to account for pad thickness.
      // 0.0 was potentially too far out for short nails. 0.1 is a safe compromise.
      const shiftRatio = 0.1;
      
      const cx = tip.x + nx * (nailLength * shiftRatio);
      const cy = tip.y + ny * (nailLength * shiftRatio);

      return {
        finger: finger.name,
        width: nailWidth,
        length: nailLength,
        boundingBox: {
          x: cx, 
          y: cy, 
          width: nailWidth,
          height: nailLength,
          rotation: rotation
        }
      };
    });
  };

  const detect = useCallback(async (imageElement: HTMLImageElement): Promise<DetectionResult> => {
    if (!landmarker) throw new Error("Model not loaded");

    const result: HandLandmarkerResult = landmarker.detect(imageElement);
    
    const measurements: NailMeasurement[] = [];
    
    if (result.landmarks) {
      result.landmarks.forEach((handLandmarks: NormalizedLandmark[]) => {
        measurements.push(...estimateNailBounds(handLandmarks));
      });
    }

    return {
      measurements,
      landmarks: result.landmarks
    };
  }, [landmarker]);

  return { detect, isLoading, error };
};
