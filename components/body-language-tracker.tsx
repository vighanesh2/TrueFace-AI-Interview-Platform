"use client";

import { useEffect, useRef, useState } from "react";

export function BodyLanguageTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [motionScore, setMotionScore] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  // Refs for our math engine
  const previousImageData = useRef<Uint8ClampedArray | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    setIsActive(false);
    setMotionScore(0);
    setWarnings([]);
  };

  // --- THE PIXEL DIFFERENCING ALGORITHM ---
  const analyzeFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    
    if (!ctx || video.videoWidth === 0) {
      animationFrameId.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    // Match canvas size to video size (scale down for performance)
    if (canvas.width !== 64) {
      canvas.width = 64;
      canvas.height = 48;
    }

    // Draw the current video frame onto the hidden canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const currentData = currentFrame.data;

    if (previousImageData.current) {
      let diffCount = 0;
      const totalPixels = currentData.length / 4;

      // Compare current frame to previous frame
      for (let i = 0; i < currentData.length; i += 4) {
        const rDiff = Math.abs(currentData[i] - previousImageData.current[i]);
        const gDiff = Math.abs(currentData[i + 1] - previousImageData.current[i + 1]);
        const bDiff = Math.abs(currentData[i + 2] - previousImageData.current[i + 2]);
        
        // If the color changed significantly, it means movement!
        if (rDiff + gDiff + bDiff > 50) {
          diffCount++;
        }
      }

      // Calculate motion as a percentage (0 to 100)
      const currentMotion = Math.min(100, Math.round((diffCount / totalPixels) * 250));
      
      // Smooth the score out so it doesn't jump crazily
      setMotionScore(prev => Math.round(prev * 0.8 + currentMotion * 0.2));

      // Trigger a warning if they move too much!
      if (currentMotion > 45) {
        if (!warnings.includes("Moving too much!")) {
          setWarnings(prev => ["Moving too much!", ...prev].slice(0, 3));
          
          // Clear warning after 3 seconds
          if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
          warningTimeoutRef.current = setTimeout(() => setWarnings([]), 3000);
        }
      }
    }

    // Save this frame to compare against the next one
    previousImageData.current = new Uint8ClampedArray(currentData);
    
    // Loop the function at 30fps
    setTimeout(() => {
      animationFrameId.current = requestAnimationFrame(analyzeFrame);
    }, 1000 / 30); 
  };

  // Start the analysis loop when the camera turns on
  useEffect(() => {
    if (isActive) {
      animationFrameId.current = requestAnimationFrame(analyzeFrame);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [isActive]);

  return (
    <div className="flex flex-col items-center bg-gray-900 p-6 rounded-xl border border-gray-700 max-w-sm w-full">
      <h2 className="text-xl font-bold text-white mb-4">Body Language AI</h2>
      
      {/* Video Feed */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-800 mb-4 shadow-lg group">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transform -scale-x-100 ${isActive ? 'opacity-100' : 'opacity-0'}`} 
        />
        
        {/* Hidden Canvas for Math Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Camera Offline
          </div>
        )}
      </div>

      {/* Controls & Metrics */}
      <div className="w-full space-y-4">
        <button 
          onClick={isActive ? stopCamera : startCamera}
          className={`w-full py-2 rounded font-bold transition-colors ${isActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
        >
          {isActive ? "Stop Tracking" : "Start Tracking"}
        </button>

        {isActive && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Fidget / Motion Score:</span>
              <span className={`font-mono font-bold ${motionScore > 40 ? 'text-red-400' : motionScore > 20 ? 'text-yellow-400' : 'text-green-400'}`}>
                {motionScore}%
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${motionScore > 40 ? 'bg-red-500' : motionScore > 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, motionScore)}%` }}
              />
            </div>

            {/* Warnings Log */}
            {warnings.length > 0 && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-xs font-semibold animate-pulse">
                ⚠️ {warnings[0]}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}