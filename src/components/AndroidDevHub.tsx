import React, { useState } from "react";
import { Folder, FileCode, Check, Copy, ChevronRight, BookOpen, Layers, Cpu, Database, Smartphone } from "lucide-react";
import { androidFiles } from "../androidFiles";

export default function AndroidDevHub() {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "architecture">("code");

  const currentFile = androidFiles[selectedFileIndex];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const architectureDecisions = [
    {
      title: "Clean Architecture: Separation of Concerns",
      icon: <Layers className="w-5 h-5 text-[#D0BCFF]" />,
      text: "The Android application is architected following Clean Architecture standards recommended by Google. It enforces strict boundary lines separating the Core Logic (Domain Layer), Device Storage & APIs (Data Layer), and Jetpack Compose (Presentation Layer). This allows offline-first Room data models to easily migrate or synchronize with Cloud Firestore later without refactoring UI logic."
    },
    {
      title: "MVVM with StateFlow State Mutation",
      icon: <Smartphone className="w-5 h-5 text-teal-300" />,
      text: "We utilize Model-View-ViewModel (MVVM) to drive our interactive flows. CanvasState represents an immutable, single source of truth propagated via stateful Kotlin flow (StateFlow) to avoid race conditions. A double-buffered stack architecture in the CanvasViewModel ensures full local Undo/Redo capability for handwriting, strokes, and shapes."
    },
    {
      title: "Hilt DI & Base Scope Providers",
      icon: <Cpu className="w-5 h-5 text-amber-300" />,
      text: "Dependency Injection via Hilt provides modular decoupling, injecting database adapters, coroutine dispatchers, and digital ink managers. Scoped dispatchers (e.g., Dispatchers.IO) run background operations safely, ensuring database updates or heavy math rendering never block the main thread."
    },
    {
      title: "Room Database for Infinite Board Sync",
      icon: <Database className="w-5 h-5 text-pink-300" />,
      text: "A Room persistence layer stores board elements locally. JSON TypeConverters serialize complex lists of hand-drawn vector coordinates (Point offsets) on-the-fly, allowing smooth, fast rendering of thousands of individual elements without disk performance lags."
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto bg-[#121212] border border-[#333333] rounded-3xl overflow-hidden shadow-2xl mt-4 animate-in fade-in duration-300">
      {/* Dev Hub Header */}
      <div className="bg-[#1C1C1C] px-6 py-5 border-b border-[#333333] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#2B2930] text-[#D0BCFF] text-xs font-semibold rounded-full uppercase tracking-wider font-mono border border-[#D0BCFF]/20">Android Phase 1 Ready</span>
            <span className="text-xs text-[#938F99] font-mono">Target: Android 12+ (API 31+)</span>
          </div>
          <h2 className="text-xl font-bold text-gray-100 mt-1">InkFlow AI Android Architectural Companion</h2>
          <p className="text-xs text-[#938F99] mt-0.5">Explore production-ready Kotlin files and architectural schemas designed for Play Store readiness.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[#0A0A0A] rounded-full p-1 border border-[#333333] shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("code")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "code" ? "bg-[#D0BCFF] text-[#381E72] shadow" : "text-[#938F99] hover:text-[#E6E1E5]"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Phase 1 Source Code</span>
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "architecture" ? "bg-[#D0BCFF] text-[#381E72] shadow" : "text-[#938F99] hover:text-[#E6E1E5]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Architecture Rationale</span>
          </button>
        </div>
      </div>

      {activeTab === "code" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[550px]">
          {/* File Explorer Tree */}
          <div className="lg:col-span-4 bg-[#0A0A0A] p-4 border-r border-[#333333]">
            <h3 className="text-xs font-bold text-[#938F99] uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
              <Folder className="w-4 h-4 text-[#D0BCFF]" />
              <span>Project Files Tree</span>
            </h3>

            <div className="space-y-1 font-mono text-xs">
              <div className="text-[#938F99] py-1 px-2 flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3" />
                <span>app / src / main / java / com / inkflow / app</span>
              </div>
              <div className="pl-4 space-y-1">
                {androidFiles.map((file, index) => {
                  const isSelected = selectedFileIndex === index;
                  return (
                    <button
                      key={file.name}
                      onClick={() => setSelectedFileIndex(index)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? "bg-[#2B2930] text-[#D0BCFF] border-l-2 border-[#D0BCFF] pl-2.5 font-bold"
                          : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                      }`}
                    >
                      <FileCode className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <span className="block font-semibold">{file.name}</span>
                        <span className="block text-[9px] text-[#938F99] truncate mt-0.5">{file.path}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#1C1C1C] rounded-2xl border border-[#333333]">
              <h4 className="text-xs font-bold text-gray-200">Phase 1 Base Dependencies:</h4>
              <ul className="text-[10px] text-[#938F99] mt-2 space-y-1.5 font-mono">
                <li>• <strong className="text-gray-300">Hilt Dependency Injection</strong> (2.50)</li>
                <li>• <strong className="text-gray-300">Jetpack Compose UI</strong> (1.6)</li>
                <li>• <strong className="text-gray-300">Room Local Database</strong> (2.6.1)</li>
                <li>• <strong className="text-gray-300">ML Kit Digital Ink</strong> (17.2.0)</li>
                <li>• <strong className="text-gray-300">Coroutines & Flow</strong> (1.7.3)</li>
              </ul>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-8 bg-[#121212] flex flex-col">
            <div className="bg-[#1C1C1C] px-4 py-2 border-b border-[#333333] flex items-center justify-between text-xs text-[#938F99] font-mono">
              <span className="truncate">{currentFile.path}</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0A0A0A] hover:bg-[#1C1C1C] text-gray-200 rounded-lg transition-colors border border-[#333333] active:scale-95 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#D0BCFF]" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto max-h-[500px]">
              <pre className="text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto select-all p-2 rounded bg-black/40">
                <code>{currentFile.content}</code>
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* Architecture Rationale Tab */
        <div className="p-6 bg-[#0A0A0A]/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {architectureDecisions.map((decision) => (
              <div key={decision.title} className="bg-[#121212] border border-[#333333] rounded-2xl p-5 hover:border-[#D0BCFF]/50 transition-all flex gap-4">
                <div className="p-3 bg-[#1C1C1C] rounded-xl self-start">
                  {decision.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-200 font-title-lg">{decision.title}</h3>
                  <p className="text-xs text-[#938F99] leading-relaxed mt-2">{decision.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Optimization Strategy Alert */}
          <div className="mt-6 bg-[#2B2930] border border-[#D0BCFF]/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-[#D0BCFF] uppercase tracking-wider font-mono">Tablet Canvas Drawing Optimizer (60 FPS Performance)</h4>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                To prevent main thread performance lag during continuous handwriting with high vector points density, InkFlow AI implements Compose path-smoothing with <code className="bg-black/40 px-1 py-0.5 rounded text-[#D0BCFF]">cubicTo()</code> quadratic bezier smoothing. For over 100,000 coordinates, it delegates strokes to a cached <code className="bg-black/40 px-1 py-0.5 rounded text-[#D0BCFF]">Picture</code> canvas layer, redraw-optimized via coordinate translation offsets.
              </p>
            </div>
            <div className="shrink-0 bg-[#2B2930] p-2.5 rounded-full border border-[#D0BCFF]/25">
              <Smartphone className="w-6 h-6 text-[#D0BCFF]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
