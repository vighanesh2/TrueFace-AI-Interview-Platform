"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import clsx from "clsx";

const PIP_MOTION_THRESHOLD = 45;
const PIXEL_DIFF_THRESHOLD = 50;
const ANALYSIS_W = 64;
const ANALYSIS_H = 48;
const FRAME_MS = 1000 / 30;

/**
 * Pixel-diff motion analysis on an existing <video> (e.g. interview PiP).
 * Caller must render a hidden <canvas ref={canvasRef} /> next to the video.
 */
export function useBodyLanguageAnalysis(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [motionScore, setMotionScore] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const previousImageData = useRef<Uint8ClampedArray | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const clearTimers = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (frameTimeoutRef.current != null) {
      clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current != null) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback(() => {
    frameTimeoutRef.current = setTimeout(() => {
      frameTimeoutRef.current = null;
      if (activeRef.current) {
        rafRef.current = requestAnimationFrame(() => tickRef.current());
      }
    }, FRAME_MS);
  }, []);

  const analyzeFrame = useCallback(() => {
    if (!activeRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      scheduleNext();
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || video.videoWidth === 0) {
      scheduleNext();
      return;
    }

    if (canvas.width !== ANALYSIS_W) {
      canvas.width = ANALYSIS_W;
      canvas.height = ANALYSIS_H;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const currentData = currentFrame.data;

    if (previousImageData.current) {
      let diffCount = 0;
      const totalPixels = currentData.length / 4;
      const prev = previousImageData.current;

      for (let i = 0; i < currentData.length; i += 4) {
        const rDiff = Math.abs(currentData[i]! - prev[i]!);
        const gDiff = Math.abs(currentData[i + 1]! - prev[i + 1]!);
        const bDiff = Math.abs(currentData[i + 2]! - prev[i + 2]!);
        if (rDiff + gDiff + bDiff > PIXEL_DIFF_THRESHOLD) diffCount++;
      }

      const currentMotion = Math.min(100, Math.round((diffCount / totalPixels) * 250));
      setMotionScore((prevScore) => Math.round(prevScore * 0.8 + currentMotion * 0.2));

      if (currentMotion > PIP_MOTION_THRESHOLD) {
        setWarnings((prev) =>
          prev.includes("Moving too much!") ? prev : ["Moving too much!", ...prev].slice(0, 3)
        );
        if (warningTimeoutRef.current != null) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setWarnings([]), 3000);
      }
    }

    previousImageData.current = new Uint8ClampedArray(currentData);
    scheduleNext();
  }, [videoRef, scheduleNext]);

  useEffect(() => {
    tickRef.current = analyzeFrame;
  }, [analyzeFrame]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      previousImageData.current = null;
      queueMicrotask(() => {
        setMotionScore(0);
        setWarnings([]);
      });
      return;
    }

    rafRef.current = requestAnimationFrame(() => tickRef.current());

    return () => {
      clearTimers();
    };
  }, [active, clearTimers]);

  return { motionScore, warnings, canvasRef };
}

/** Optional HUD for interview PiP — motion bar + warning (caller supplies scores from the hook). */
export function BodyLanguagePipHud({
  motionScore,
  warnings,
  className,
}: {
  motionScore: number;
  warnings: string[];
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-white/95">
        <span className="text-white/70">Motion</span>
        <span
          className={clsx(
            "font-mono tabular-nums",
            motionScore > 40 ? "text-red-300" : motionScore > 20 ? "text-amber-300" : "text-emerald-300"
          )}
        >
          {motionScore}%
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-100",
            motionScore > 40 ? "bg-red-500" : motionScore > 20 ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${Math.min(100, motionScore)}%` }}
        />
      </div>
      {warnings.length > 0 && (
        <p className="mt-1.5 text-center text-[10px] font-semibold text-red-300 drop-shadow-sm">
          ⚠️ {warnings[0]}
        </p>
      )}
    </div>
  );
}

/** Standalone demo card with its own camera stream. */
export function BodyLanguageTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const { motionScore, warnings, canvasRef } = useBodyLanguageAnalysis(videoRef, isActive);

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
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center rounded-xl border border-gray-700 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-bold text-white">Body Language AI</h2>

      <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg border-2 border-gray-800 bg-black shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={clsx(
            "h-full w-full -scale-x-100 object-cover",
            isActive ? "opacity-100" : "opacity-0"
          )}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">Camera Offline</div>
        )}
      </div>

      <div className="w-full space-y-4">
        <button
          type="button"
          onClick={isActive ? stopCamera : startCamera}
          className={clsx(
            "w-full rounded py-2 font-bold transition-colors",
            isActive ? "bg-red-600 text-white hover:bg-red-500" : "bg-cyan-600 text-white hover:bg-cyan-500"
          )}
        >
          {isActive ? "Stop Tracking" : "Start Tracking"}
        </button>

        {isActive && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Fidget / Motion Score:</span>
              <span
                className={clsx(
                  "font-mono font-bold",
                  motionScore > 40 ? "text-red-400" : motionScore > 20 ? "text-yellow-400" : "text-green-400"
                )}
              >
                {motionScore}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className={clsx(
                  "h-full transition-all duration-100",
                  motionScore > 40 ? "bg-red-500" : motionScore > 20 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(100, motionScore)}%` }}
              />
            </div>
            {warnings.length > 0 && (
              <div className="mt-4 animate-pulse rounded border border-red-800 bg-red-900/30 p-3 text-xs font-semibold text-red-300">
                ⚠️ {warnings[0]}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
