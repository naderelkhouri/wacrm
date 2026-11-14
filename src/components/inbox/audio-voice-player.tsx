"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioVoicePlayerProps {
  src: string;
  isFromMe?: boolean;
}

export function AudioVoicePlayer({ src, isFromMe = false }: AudioVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  const SPEEDS = [1, 1.5, 2];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!Number.isFinite(duration) && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.warn("[audio-player] play error:", err));
    }
  }, [isPlaying]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    audio.playbackRate = SPEEDS[nextIndex];
  }, [speedIndex, SPEEDS]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const targetPercent = Math.max(0, Math.min(1, clickX / width));
    const targetTime = targetPercent * duration;

    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Waveform bars simulation with pseudo-random aesthetic heights
  const BARS_COUNT = 28;
  const BAR_HEIGHTS = [
    30, 45, 70, 95, 60, 40, 85, 100, 75, 50, 65, 90, 80, 55,
    40, 70, 85, 60, 45, 95, 80, 60, 40, 75, 90, 65, 45, 30
  ];

  return (
    <div className="flex flex-col gap-1.5 py-1 min-w-[210px] sm:min-w-[240px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isFromMe
              ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
          aria-label={isPlaying ? "Pausar áudio" : "Tocar áudio"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Waveform track */}
        <div
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercent)}
          onClick={handleSeek}
          className="relative flex flex-1 items-center gap-[2.5px] h-7 cursor-pointer group select-none px-1"
        >
          {BAR_HEIGHTS.slice(0, BARS_COUNT).map((height, i) => {
            const barPercent = (i / (BARS_COUNT - 1)) * 100;
            const isPlayed = barPercent <= progressPercent;

            return (
              <span
                key={i}
                style={{ height: `${height}%` }}
                className={cn(
                  "w-[3px] rounded-full transition-colors",
                  isPlayed
                    ? isFromMe
                      ? "bg-primary-foreground"
                      : "bg-primary"
                    : isFromMe
                      ? "bg-primary-foreground/40"
                      : "bg-muted-foreground/30 group-hover:bg-muted-foreground/40"
                )}
              />
            );
          })}
        </div>

        {/* Speed multiplier pill */}
        <button
          type="button"
          onClick={cycleSpeed}
          className={cn(
            "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight transition-colors",
            isFromMe
              ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
          title="Velocidade de reprodução"
        >
          {SPEEDS[speedIndex]}x
        </button>
      </div>

      {/* Time indicators */}
      <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground/80 font-medium">
        <span>{formatTime(currentTime)}</span>
        <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
      </div>
    </div>
  );
}
