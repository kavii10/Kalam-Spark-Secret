import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Coffee, SkipForward, Play, Pause, Timer } from "lucide-react";

/**
 * Compact inline Pomodoro chip for the App header.
 * No longer a fixed bottom-left overlay — it sits inline next to the Settings button.
 */
export default function PomodoroTimer() {
  const FOCUS_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;

  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isActive, setIsActive] = useState(true);
  const [showBreakModal, setShowBreakModal] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      if (mode === "focus") {
        setMode("break");
        setTimeLeft(BREAK_TIME);
        setShowBreakModal(true);
      } else {
        setMode("focus");
        setTimeLeft(FOCUS_TIME);
        setShowBreakModal(false);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const skipBreak = () => {
    setMode("focus");
    setTimeLeft(FOCUS_TIME);
    setShowBreakModal(false);
    setIsActive(true);
  };

  const isFocus = mode === "focus";

  return (
    <>
      {/* Inline header chip */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:opacity-80 select-none"
        style={{
          background: isFocus ? "rgba(211,156,59,0.08)" : "rgba(59,130,246,0.08)",
          border: `1px solid ${isFocus ? "rgba(211,156,59,0.25)" : "rgba(59,130,246,0.25)"}`,
        }}
        onClick={() => setIsActive(!isActive)}
        title={isActive ? "Pause timer" : "Resume timer"}
      >
        {isFocus
          ? (isActive ? <Pause size={12} className="text-gold-400" /> : <Play size={12} className="text-gold-400" />)
          : <Coffee size={12} className="text-blue-400" />
        }
        <span className={`font-mono ${isFocus ? "text-gold-300" : "text-blue-300"}`}>
          {formatTime(timeLeft)}
        </span>
        <span className={`hidden sm:inline text-[10px] uppercase tracking-wider opacity-60 ${isFocus ? "text-gold-400" : "text-blue-400"}`}>
          {isFocus ? "Focus" : "Break"}
        </span>
      </div>

      {/* Break modal (rendered via portal to prevent clipping by header's backdrop-filter) */}
      {showBreakModal && mode === "break" && createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div
            className="w-full max-w-md rounded-3xl p-10 flex flex-col items-center text-center text-blue-100"
            style={{
              background: "rgba(10,15,35,0.95)",
              border: "1px solid rgba(59,130,246,0.3)",
              boxShadow: "0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(59,130,246,0.1) inset",
            }}
          >
            <div
              className="w-20 h-20 rounded-full mb-6 flex items-center justify-center"
              style={{ background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.05) 100%)", border: "1px solid rgba(59,130,246,0.4)" }}
            >
              <Coffee size={32} className="text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold mb-3 font-cinzel text-blue-300">Time for a Break!</h2>
            <p className="text-sm text-blue-200/60 mb-8 max-w-[280px] leading-relaxed">
              You've focused for 25 minutes. Take 5 minutes to stretch, drink water, and rest your eyes.
            </p>
            <div className="text-6xl font-mono font-bold mb-10 text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]">
              {formatTime(timeLeft)}
            </div>
            <button
              onClick={skipBreak}
              className="flex-1 w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 flex items-center justify-center gap-2"
              style={{ border: "1px solid rgba(59,130,246,0.3)" }}
            >
              <SkipForward size={16} /> Skip Break
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
