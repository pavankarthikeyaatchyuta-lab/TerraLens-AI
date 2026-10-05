"use client";

import React from "react";
import { Radio, BarChart3, Sun, Moon, Check } from "lucide-react";
import { useTheme } from "@/lib/themeContext";

export type WorkflowStage = "SEARCH" | "DISCOVER" | "COMPARE" | "VERIFY" | "EXPORT";

export interface HeaderProps {
  currentStage: WorkflowStage;
  onSelectStage: (stage: WorkflowStage) => void;
  maxCompletedStageIndex?: number;
  onOpenEvaluation: () => void;
  operatingMode?: string;
  onSelectMode?: (mode: any) => void;
  latencyMs?: number;
  totalScenes?: number;
}

const STAGES: { id: WorkflowStage; num: number; label: string }[] = [
  { id: "SEARCH", num: 1, label: "SEARCH" },
  { id: "DISCOVER", num: 2, label: "DISCOVER" },
  { id: "COMPARE", num: 3, label: "COMPARE" },
  { id: "VERIFY", num: 4, label: "VERIFY" },
  { id: "EXPORT", num: 5, label: "EXPORT" },
];

export function Header({
  currentStage,
  onSelectStage,
  maxCompletedStageIndex = 0,
  onOpenEvaluation,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <header className="neu-raised sticky top-0 z-40 transition-colors px-4 py-3 backdrop-blur-xl border-b border-tactical-700/60">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Problem Statement Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-700/30 border border-sky-400/40 text-sky-400 font-bold shadow-md shadow-sky-950/50">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-wider text-slate-900 dark:text-slate-100 uppercase font-mono">
              TerraLens <span className="text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]">AI</span>
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-tactical-900 text-sky-400 border border-sky-500/30 font-bold tracking-widest neu-pill">
              SIH26227
            </span>
          </div>
        </div>

        {/* Primary 5-Stage Workflow Navigator (3D Neumorphic Tactile Console) */}
        <nav className="flex items-center p-1.5 rounded-2xl neu-inset font-mono text-xs gap-1">
          {STAGES.map((stage, idx) => {
            const isCurrent = stage.id === currentStage;
            const isCompleted = idx < currentIndex;
            const isNavigable = idx <= maxCompletedStageIndex || isCompleted;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  if (isNavigable || isCurrent) {
                    onSelectStage(stage.id);
                  }
                }}
                disabled={!isNavigable && !isCurrent}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all text-xs font-bold tracking-wider ${
                  isCurrent
                    ? "neu-btn-primary shadow-lg shadow-sky-950/80 scale-[1.03]"
                    : isCompleted
                    ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 neu-pill cursor-pointer"
                    : isNavigable
                    ? "text-slate-300 hover:text-white hover:bg-tactical-800 neu-btn cursor-pointer"
                    : "text-slate-600 opacity-50 cursor-not-allowed"
                }`}
                title={`Navigate to Stage ${stage.num}: ${stage.label}`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isCurrent
                        ? "bg-white text-sky-800 shadow-sm"
                        : "bg-tactical-800 text-slate-400"
                    }`}
                  >
                    {stage.num}
                  </span>
                )}
                <span>{stage.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: System / Evaluation + Theme Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenEvaluation}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl neu-btn text-slate-300 font-mono text-xs font-bold transition-all hover:text-white hover:border-sky-500/50"
            title="Open SIH26227 Benchmark Evaluation & System Diagnostics"
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">EVALUATION &amp; SYSTEM</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl neu-btn text-slate-300 font-mono transition-all hover:text-white"
            title={`Toggle Theme (Current: ${theme})`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
