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
    <header className="border-b border-tactical-700 bg-tactical-850/95 backdrop-blur-md px-4 py-2.5 sticky top-0 z-40 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Problem Statement Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-600/15 border border-sky-500/30 text-sky-500 font-bold shadow-sm">
            <Radio className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase font-mono">
              TerraLens <span className="text-sky-500">AI</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tactical-800 text-sky-400 border border-tactical-700 font-semibold tracking-wider">
              SIH26227
            </span>
          </div>
        </div>

        {/* Primary 5-Stage Workflow Navigator */}
        <nav className="flex items-center p-1 rounded-xl bg-tactical-900/90 border border-tactical-750 font-mono text-xs">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                  isCurrent
                    ? "bg-sky-600 text-white font-bold shadow-sm ring-1 ring-sky-400/40"
                    : isCompleted
                    ? "text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
                    : isNavigable
                    ? "text-slate-300 hover:text-white hover:bg-tactical-800 cursor-pointer"
                    : "text-slate-600 opacity-60 cursor-not-allowed"
                }`}
                title={`Navigate to Stage ${stage.num}: ${stage.label}`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      isCurrent
                        ? "bg-white text-sky-700 font-bold"
                        : "bg-tactical-800 text-slate-400"
                    }`}
                  >
                    {stage.num}
                  </span>
                )}
                <span className="tracking-wider">{stage.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: System / Evaluation + Theme Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenEvaluation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-750 text-slate-300 border border-tactical-700 font-mono text-xs font-semibold transition-all hover:border-sky-500/40 shadow-sm"
            title="Open SIH26227 Benchmark Evaluation & System Diagnostics"
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">EVALUATION &amp; SYSTEM</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-750 text-slate-300 border border-tactical-700 font-mono transition-all shadow-sm"
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
