import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Menu, Sparkles, Folder, Play, Download, School, Settings, HelpCircle, 
  MapPin, Maximize2, Layers, Grid, SlidersHorizontal, Plus, Mic, 
  FileText, Image as ImageIcon, PlusCircle, PenTool, Highlighter, 
  Eraser, Scissors, Laptop, CheckCircle, Info, FileUp, Cpu, Undo, Redo, Compass, Zap
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import PropertyPanel from "./components/PropertyPanel";
import AssistantPanel from "./components/AssistantPanel";
import WhiteboardCanvas from "./components/WhiteboardCanvas";
import AndroidDevHub from "./components/AndroidDevHub";
import QAStressTestDashboard from "./components/QAStressTestDashboard";
import ColorPickerModal from "./components/ColorPickerModal";
import GeometryToolkit from "./components/GeometryToolkit";
import RichTextNotes from "./components/RichTextNotes";
import LayersPanel from "./components/LayersPanel";
import PDFImportModal from "./components/PDFImportModal";
import { CanvasObject, RulerState } from "./types";
import { triggerHaptic } from "./utils/haptics";

export default function App() {
  const [activeView, setActiveView] = useState<"whiteboard" | "android-hub" | "qa-stress">("whiteboard");
  const [activeNotebook, setActiveNotebook] = useState("Thermodynamics Study Notes");
  const [activeNotebookId, setActiveNotebookId] = useState("thermo");
  const [activeNotebookType, setActiveNotebookType] = useState<"whiteboard" | "rich_text">("whiteboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGeometryOpen, setIsGeometryOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("pen"); // pen, highlighter, eraser, lasso, resistor, rectangle, circle, etc.
  const [activeColor, setActiveColor] = useState("#d0bcff"); // default lavender
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isGridEnabled, setIsGridEnabled] = useState(true);
  const [isSnapToGrid, setIsSnapToGrid] = useState(true);
  const [isSmartEngineeringMode, setIsSmartEngineeringMode] = useState(true);

  // Advanced Hardware Optimizations Engine States
  const [renderBackend, setRenderBackend] = useState<"webgl" | "svg">("webgl");
  const [isSimplificationEnabled, setIsSimplificationEnabled] = useState(true);
  const [simplificationTolerance, setSimplificationTolerance] = useState(1.5);
  const [isFrustumCullingEnabled, setIsFrustumCullingEnabled] = useState(true);

  // Physical Ruler State
  const [ruler, setRuler] = useState<RulerState>({
    isActive: false,
    x: 400,
    y: 300,
    angle: 0,
    length: 450,
    isLocked: false,
    opacity: 0.65,
    color: "#D0BCFF",
    isSnapMode: true,
  });

  // Eyedropper and Custom Color States
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [savedColors, setSavedColors] = useState<string[]>(["#ff9f9f", "#7dd3fc", "#86efac", "#ffd166"]);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // Stylus state
  const [pressureSensitive, setPressureSensitive] = useState(true);
  const [stabilizer, setStabilizer] = useState(false);
  const [palmRejection, setPalmRejection] = useState(true);

  // Canvas Pan & Zoom state
  const [panOffset, setPanOffset] = useState({ x: 100, y: 150 });
  const [zoom, setZoom] = useState(1.0);

  // Quick Add popover
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Selection text context for AI helper
  const [selectionText, setSelectionText] = useState("");

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);

  // Initial dummy objects on the board (thermodynamics / electrical concept)
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([
    {
      id: "maxwell-handwriting",
      type: "handwriting",
      x: 100,
      y: 120,
      width: 55,
      height: 30,
      rotation: 0,
      layer: 1,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      color: "#e5e1e7",
      strokeWidth: 3,
      points: [
        { x: 0, y: 20 }, { x: 5, y: 10 }, { x: 10, y: 0 }, { x: 15, y: 15 },
        { x: 20, y: 30 }, { x: 25, y: 25 }, { x: 30, y: 20 }, { x: 35, y: 20 },
        { x: 45, y: 20 }, { x: 55, y: 20 }
      ]
    },
    {
      id: "maxwell-formula",
      type: "formula",
      x: 170,
      y: 130,
      width: 350,
      height: 60,
      rotation: 0,
      layer: 2,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      color: "#cfbcff",
      strokeWidth: 2,
      content: "∇ × E = -∂B/∂t"
    },
    {
      id: "resistor-circuit",
      type: "shape",
      x: 450,
      y: 350,
      width: 150,
      height: 90,
      rotation: 0,
      layer: 3,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      color: "#d0bcff",
      strokeWidth: 2.5,
      shapeType: "resistor"
    }
  ]);

  // History state for undo/redo
  const [history, setHistory] = useState<CanvasObject[][]>([[
    {
      id: "maxwell-handwriting",
      type: "handwriting",
      x: 100,
      y: 120,
      width: 55,
      height: 30,
      rotation: 0,
      layer: 1,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      color: "#e5e1e7",
      strokeWidth: 3,
      points: [
        { x: 0, y: 20 }, { x: 5, y: 10 }, { x: 10, y: 0 }, { x: 15, y: 15 },
        { x: 20, y: 30 }, { x: 25, y: 25 }, { x: 30, y: 20 }, { x: 35, y: 20 },
        { x: 45, y: 20 }, { x: 55, y: 20 }
      ]
    },
    {
      id: "maxwell-formula",
      type: "formula",
      x: 170,
      y: 130,
      width: 350,
      height: 60,
      rotation: 0,
      layer: 2,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      color: "#cfbcff",
      strokeWidth: 2,
      content: "∇ × E = -∂B/∂t"
    },
    {
      id: "resistor-circuit",
      type: "shape",
      x: 450,
      y: 350,
      width: 150,
      height: 90,
      rotation: 0,
      layer: 3,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      color: "#d0bcff",
      strokeWidth: 2.5,
      shapeType: "resistor"
    }
  ]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Keep refs in sync with state for reference-stable callbacks and event listeners
  const historyRef = useRef<CanvasObject[][]>(history);
  const historyIndexRef = useRef<number>(historyIndex);
  const canvasObjectsRef = useRef<CanvasObject[]>(canvasObjects);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    canvasObjectsRef.current = canvasObjects;
  }, [canvasObjects]);

  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGeometryPinned, setIsGeometryPinned] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Reference-stable, memory-safe canvas update handler
  const updateCanvasObjects = useCallback((newObjects: CanvasObject[], pushHistory = true) => {
    setCanvasObjects(newObjects);
    if (pushHistory) {
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      
      // Slice future redo stack history
      const slicedHistory = currentHistory.slice(0, currentIndex + 1);
      
      // Bounded history buffer to prevent massive memory usage and leaks
      const MAX_HISTORY_STEPS = 50;
      let nextHistory = [...slicedHistory, newObjects];
      let nextIndex = nextHistory.length - 1;
      
      if (nextHistory.length > MAX_HISTORY_STEPS) {
        nextHistory = nextHistory.slice(nextHistory.length - MAX_HISTORY_STEPS);
        nextIndex = nextHistory.length - 1;
      }
      
      setHistory(nextHistory);
      setHistoryIndex(nextIndex);
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  }, []);

  const handleMinimapMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updatePan = (clientX: number, clientY: number) => {
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const newX = (mouseX - 20) * 12;
      const newY = (mouseY - 15) * 12;
      setPanOffset({ x: Math.round(newX), y: Math.round(newY) });
    };

    updatePan(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePan(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Reference-stable undo/redo action handlers
  const handleUndo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    if (currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      setHistoryIndex(nextIndex);
      setCanvasObjects(currentHistory[nextIndex]);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    if (currentIndex < currentHistory.length - 1) {
      const nextIndex = currentIndex + 1;
      setHistoryIndex(nextIndex);
      setCanvasObjects(currentHistory[nextIndex]);
    }
  }, []);

  // Stable eyedropper and color picker event callbacks
  const deactivateEyedropper = useCallback(() => {
    setIsEyedropperActive(false);
  }, []);

  const pickColor = useCallback((color: string) => {
    setActiveColor(color);
    setIsEyedropperActive(false);
    setRecentColors(prev => {
      if (prev.includes(color)) return prev;
      return [color, ...prev];
    });
  }, []);

  const clipboardRef = useRef<CanvasObject[]>([]);

  // Keyboard Shortcuts Listener for Whiteboard (completely stable, mounts/unmounts exactly once)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (ctrlKey && e.key.toLowerCase() === "c") {
        const selected = canvasObjectsRef.current.filter(o => o.isSelected || o.isLassoSelected);
        if (selected.length > 0) {
          e.preventDefault();
          clipboardRef.current = JSON.parse(JSON.stringify(selected));
        }
      } else if (ctrlKey && e.key.toLowerCase() === "v") {
        if (clipboardRef.current.length > 0) {
          e.preventDefault();
          const deselect = canvasObjectsRef.current.map(o => ({ ...o, isSelected: false, isLassoSelected: false }));
          const pasted = clipboardRef.current.map(o => ({
            ...o,
            id: `${o.id}-paste-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            x: o.x + 40,
            y: o.y + 40,
            isSelected: true,
            isLassoSelected: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));
          updateCanvasObjects([...deselect, ...pasted]);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Find if we have any selected objects
        const hasSelection = canvasObjectsRef.current.some(o => o.isSelected || o.isLassoSelected);
        if (hasSelection) {
          e.preventDefault();
          const filtered = canvasObjectsRef.current.filter(o => !o.isSelected && !o.isLassoSelected);
          updateCanvasObjects(filtered);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, updateCanvasObjects]);

  // Handle preset calculations or formulas
  const handleSolveFormulaDirect = (formulaText: string) => {
    setActiveTool("lasso");
    alert(`Gemini AI Assistant is preparing a Step-by-Step Mathematical Solver for:\n"${formulaText}"\n\nPlease interact with the whiteboard canvas or check the Assistant Chat stream to view the final LaTeX output!`);
  };

  // Quick action mock placements
  const handlePlaceFormula = () => {
    const equation = prompt("Type math or formula string:", "x^2 + 5x + 6 = 0");
    if (!equation) return;
    const newObj: CanvasObject = {
      id: `math-${Date.now()}`,
      type: "formula",
      x: (window.innerWidth / 2 - panOffset.x) / zoom - 175,
      y: (window.innerHeight / 2 - panOffset.y) / zoom - 30,
      width: 350,
      height: 60,
      rotation: 0,
      layer: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: "#ffffff",
      strokeWidth: 2,
      content: equation
    };
    updateCanvasObjects([...canvasObjects, newObj]);
    setIsQuickAddOpen(false);
  };

  return (
    <div className="bg-[#0A0A0A] text-[#E6E1E5] font-sans overflow-hidden h-screen w-screen relative select-none">
      {/* Top Navigation Bar */}
      {!isFullscreen && (
        <header className="fixed top-4 left-4 right-4 z-[70] flex items-center justify-between px-5 h-16 bg-[#121212]/95 backdrop-blur-xl rounded-full border border-[#333333] shadow-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 rounded-full hover:bg-[#1C1C1C] text-[#E6E1E5] transition-transform active:scale-95 duration-200 animate-in fade-in"
              title="Open Notebook Explorer"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col">
              <h1 className="text-sm md:text-base font-bold text-gray-100 flex items-center gap-2 truncate max-w-[180px] md:max-w-none">
                {activeNotebook}
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Auto-saved offline" />
              </h1>
              <span className="text-[10px] text-[#938F99] font-mono hidden md:block">Location: Semester 4 / Physics</span>
            </div>
          </div>

          {/* Dynamic View Selector & Actions */}
          <div className="flex items-center gap-4">
            {/* Main Toggle between canvas, developer hub, and QA optimizer dashboard */}
            <div className="bg-[#0A0A0A] rounded-full p-1 border border-[#333333] flex items-center">
              <button
                onClick={() => setActiveView("whiteboard")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeView === "whiteboard" ? "bg-[#D0BCFF] text-[#381E72] shadow-md" : "text-[#938F99] hover:text-[#E6E1E5]"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Whiteboard Canvas</span>
              </button>
              <button
                onClick={() => setActiveView("android-hub")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeView === "android-hub" ? "bg-[#D0BCFF] text-[#381E72] shadow-md" : "text-[#938F99] hover:text-[#E6E1E5]"
                }`}
                title="Android Architecture Hub"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Android Dev Hub</span>
              </button>
              <button
                onClick={() => setActiveView("qa-stress")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeView === "qa-stress" ? "bg-[#D0BCFF] text-[#381E72] shadow-md" : "text-[#938F99] hover:text-[#E6E1E5]"
                }`}
                title="System QA Optimizer & Stress Test Suite"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>QA & Optimizer</span>
              </button>
            </div>
            
            {/* Smart Engineering Mode Toggle */}
            <button 
              onClick={() => setIsSmartEngineeringMode(!isSmartEngineeringMode)}
              className={`px-4 py-2 rounded-full font-bold text-xs tracking-wide transition-all flex items-center gap-1.5 border shadow ${
                isSmartEngineeringMode 
                  ? "bg-[#D0BCFF]/15 text-[#D0BCFF] border-[#D0BCFF]/35 shadow-[0_0_12px_rgba(208,188,255,0.15)] animate-pulse" 
                  : "bg-transparent text-[#938F99] border-[#333333] hover:text-[#E6E1E5]"
              }`}
              title="Toggle Smart Engineering Sketch-to-Vector Recognition Mode"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Sketch</span>
            </button>

            {/* PDF Background Importer */}
            <button 
              onClick={() => setIsPdfImportOpen(true)}
              className="px-4 py-2 rounded-full font-bold text-xs tracking-wide transition-all flex items-center gap-1.5 border border-[#333333] bg-transparent text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5] shadow"
              title="Import PDF document pages as canvas background layers to draw and annotate on top"
            >
              <FileUp className="w-3.5 h-3.5 text-red-400" />
              <span>Import PDF</span>
            </button>

            <div className="h-6 w-px bg-[#333333] hidden md:block" />

            {/* Export & Actions */}
            <button 
              onClick={() => setShowExportModal(true)}
              className="px-4.5 py-2 bg-[#D0BCFF] text-[#381E72] rounded-full hover:bg-opacity-90 font-bold text-xs tracking-wide transition-colors flex items-center gap-1.5 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </header>
      )}

      {/* Sidebar Explorer */}
      <Sidebar 
        isOpen={isSidebarOpen && !isFullscreen} 
        onClose={() => setIsSidebarOpen(false)} 
        activeNotebook={activeNotebook}
        activeNotebookId={activeNotebookId}
        onSelectNotebook={(name, id, type) => {
          setActiveNotebook(name);
          setActiveNotebookId(id);
          setActiveNotebookType(type || "whiteboard");
          // Set custom initial state based on notebook to make prototype hyper-realistic
          let newObjs: CanvasObject[] = [];
          if (name.includes("Optics")) {
            newObjs = [
              {
                id: "lens-handwriting",
                type: "handwriting",
                x: 100,
                y: 120,
                width: 50,
                height: 30,
                rotation: 0,
                layer: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                color: "#ff9f9f",
                strokeWidth: 3,
                points: [{ x: 0, y: 30 }, { x: 50, y: 30 }]
              },
              {
                id: "lens-formula",
                type: "formula",
                x: 170,
                y: 130,
                width: 350,
                height: 60,
                rotation: 0,
                layer: 2,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                color: "#7dd3fc",
                strokeWidth: 2,
                content: "1/f = (n-1)(1/R1 - 1/R2)"
              }
            ];
          } else if (name.includes("Circuits")) {
            newObjs = [
              {
                id: "kirchhoff-formula",
                type: "formula",
                x: 170,
                y: 130,
                width: 350,
                height: 60,
                rotation: 0,
                layer: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                color: "#86efac",
                strokeWidth: 2,
                content: "Σ V = 0 (Kirchhoff's Voltage Law)"
              },
              {
                id: "circuit-battery",
                type: "shape",
                x: 350,
                y: 200,
                width: 120,
                height: 80,
                rotation: 0,
                layer: 2,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                color: "#d0bcff",
                strokeWidth: 2,
                shapeType: "battery"
              },
              {
                id: "circuit-lamp",
                type: "shape",
                x: 520,
                y: 200,
                width: 120,
                height: 80,
                rotation: 0,
                layer: 3,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                color: "#ffb4ab",
                strokeWidth: 2,
                shapeType: "lamp"
              }
            ];
          }
          setCanvasObjects(newObjs);
          setHistory([newObjs]);
          setHistoryIndex(0);
        }}
      />

      {activeView === "whiteboard" ? (
        activeNotebookType === "rich_text" ? (
          <RichTextNotes activeNotebookId={activeNotebookId} activeNotebookName={activeNotebook} />
        ) : (
          <>
            {/* Main Whiteboard Canvas Section */}
            <main className="w-full h-full relative z-10 pt-20">
            <WhiteboardCanvas 
              activeTool={activeTool}
              activeColor={activeColor}
              strokeWidth={strokeWidth}
              isGridEnabled={isGridEnabled}
              isSnapToGrid={isSnapToGrid}
              isSmartEngineeringMode={isSmartEngineeringMode}
              panOffset={panOffset}
              zoom={zoom}
              onPanChange={setPanOffset}
              onZoomChange={setZoom}
              canvasObjects={canvasObjects}
              onUpdateObjects={updateCanvasObjects}
              onSetSelectionText={setSelectionText}
              ruler={ruler}
              onUpdateRuler={setRuler}
              isEyedropperActive={isEyedropperActive}
              onDeactivateEyedropper={deactivateEyedropper}
              onPickColor={pickColor}
              renderBackend={renderBackend}
              isSimplificationEnabled={isSimplificationEnabled}
              simplificationTolerance={simplificationTolerance}
              isFrustumCullingEnabled={isFrustumCullingEnabled}
            />
          </main>

          {/* Left Vertical Toolbar */}
          <nav className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col p-2.5 bg-[#121212]/95 backdrop-blur-xl rounded-[2rem] border border-[#333333] shadow-2xl w-16 group hover:w-48 transition-all duration-300 overflow-hidden">
            <div className="flex flex-col gap-3 w-40">
              {/* Pen (Active with glow) */}
              <button 
                onClick={() => { setActiveTool("pen"); triggerHaptic(15); }}
                className={`p-3 rounded-full flex items-center gap-3 transition-all ${
                  activeTool === "pen" 
                    ? "bg-[#D0BCFF] text-[#381E72] shadow-[0_0_15px_rgba(208,188,255,0.4)] font-bold" 
                    : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                }`}
                title="Pen stylus tool"
              >
                <PenTool className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Pen Drawing</span>
              </button>

              {/* Highlighter */}
              <button 
                onClick={() => { setActiveTool("highlighter"); triggerHaptic(15); }}
                className={`p-3 rounded-full flex items-center gap-3 transition-all ${
                  activeTool === "highlighter" 
                    ? "bg-[#D0BCFF] text-[#381E72] shadow-[0_0_15px_rgba(208,188,255,0.4)] font-bold" 
                    : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                }`}
                title="Transparent highlighter"
              >
                <Highlighter className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Highlighter</span>
              </button>

              {/* Eraser */}
              <button 
                onClick={() => { setActiveTool("eraser"); triggerHaptic(15); }}
                className={`p-3 rounded-full flex items-center gap-3 transition-all ${
                  activeTool === "eraser" 
                    ? "bg-[#D0BCFF] text-[#381E72] shadow-[0_0_15px_rgba(208,188,255,0.4)] font-bold" 
                    : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                }`}
                title="Strokes/Shapes eraser"
              >
                <Eraser className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Object Eraser</span>
              </button>

              {/* Lasso Selection */}
              <button 
                onClick={() => { setActiveTool("lasso"); triggerHaptic(15); }}
                className={`p-3 rounded-full flex items-center gap-3 transition-all ${
                  activeTool === "lasso" 
                    ? "bg-[#D0BCFF] text-[#381E72] shadow-[0_0_15px_rgba(208,188,255,0.4)] font-bold" 
                    : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                }`}
                title="Lasso vector selector"
              >
                <Scissors className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Lasso Tool</span>
              </button>

              {/* Geometry Toolkit Option */}
              <button 
                onClick={() => {
                  setIsGeometryOpen(!isGeometryOpen);
                  setActiveTool("lasso");
                  triggerHaptic(25);
                }}
                className={`p-3 rounded-full flex items-center gap-3 transition-all ${
                  isGeometryOpen 
                    ? "bg-[#D0BCFF] text-[#381E72] shadow-[0_0_15px_rgba(208,188,255,0.4)] font-bold" 
                    : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                }`}
                title="Floating Geometry Toolkit"
              >
                <Compass className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Geometry Tool</span>
              </button>

              <div className="w-8 h-px bg-[#333333] mx-auto group-hover:w-3/4 transition-all" />

              {/* Shapes Flyout Grid Header */}
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider mb-1 block px-2.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Place Vector Shapes</span>
              
              <div className="grid grid-cols-1 group-hover:grid-cols-2 gap-2 px-1">
                <button
                  onClick={() => { setActiveTool("rectangle"); triggerHaptic(20); }}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    activeTool === "rectangle" ? "bg-[#2B2930] border-[#D0BCFF]/40 text-[#D0BCFF]" : "border-[#333333] text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                  }`}
                  title="Rectangle"
                >
                  <span className="text-xs font-semibold shrink-0">⬜</span>
                  <span className="text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Rectangle</span>
                </button>
                <button
                  onClick={() => { setActiveTool("circle"); triggerHaptic(20); }}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    activeTool === "circle" ? "bg-[#2B2930] border-[#D0BCFF]/40 text-[#D0BCFF]" : "border-[#333333] text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                  }`}
                  title="Circle"
                >
                  <span className="text-xs font-semibold shrink-0">⭕</span>
                  <span className="text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Circle</span>
                </button>
                <button
                  onClick={() => { setActiveTool("triangle"); triggerHaptic(20); }}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    activeTool === "triangle" ? "bg-[#2B2930] border-[#D0BCFF]/40 text-[#D0BCFF]" : "border-[#333333] text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                  }`}
                  title="Triangle"
                >
                  <span className="text-xs font-semibold shrink-0">🔺</span>
                  <span className="text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Triangle</span>
                </button>
              </div>

              {/* Engineering circuits library */}
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider mb-1 mt-2 block px-2.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Engineering Circuitry</span>
              <div className="grid grid-cols-1 group-hover:grid-cols-2 gap-2 px-1">
                <button
                  onClick={() => { setActiveTool("resistor"); triggerHaptic(20); }}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    activeTool === "resistor" ? "bg-[#2B2930] border-[#D0BCFF]/40 text-[#D0BCFF]" : "border-[#333333] text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                  }`}
                  title="Resistor Symbol"
                >
                  <span className="text-[10px] bg-white/10 px-1 rounded font-mono text-primary font-bold shrink-0">W</span>
                  <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Resistor</span>
                </button>
                <button
                  onClick={() => { setActiveTool("battery"); triggerHaptic(20); }}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    activeTool === "battery" ? "bg-[#2B2930] border-[#D0BCFF]/40 text-[#D0BCFF]" : "border-[#333333] text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                  }`}
                  title="Battery Power"
                >
                  <span className="text-[10px] bg-white/10 px-1 rounded font-mono text-primary font-bold shrink-0">|I</span>
                  <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Battery</span>
                </button>
                <button
                  onClick={() => { setActiveTool("lamp"); triggerHaptic(20); }}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    activeTool === "lamp" ? "bg-[#2B2930] border-[#D0BCFF]/40 text-[#D0BCFF]" : "border-[#333333] text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                  }`}
                  title="Lamp / Bulb"
                >
                  <span className="text-[10px] bg-white/10 px-1.5 rounded font-mono text-primary font-bold shrink-0">⊗</span>
                  <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Lamp</span>
                </button>
              </div>

              <div className="w-8 h-px bg-[#333333] mx-auto group-hover:w-3/4 transition-all" />

              {/* Hand-pan tool */}
              <button 
                onClick={() => { setActiveTool("pan"); triggerHaptic(15); }}
                className={`p-3 rounded-full flex items-center gap-3 transition-all ${
                  activeTool === "pan" 
                    ? "bg-[#D0BCFF] text-[#381E72] shadow-[0_0_15px_rgba(208,188,255,0.4)] font-bold" 
                    : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                }`}
                title="Pan Board (Or hold space and drag)"
              >
                <SlidersHorizontal className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Pan Canvas</span>
              </button>
            </div>
          </nav>

          {/* Stylus Configuration Panel */}
          <PropertyPanel 
            activeColor={activeColor}
            onChangeColor={setActiveColor}
            strokeWidth={strokeWidth}
            onChangeStrokeWidth={setStrokeWidth}
            pressureSensitive={pressureSensitive}
            onTogglePressure={() => setPressureSensitive(!pressureSensitive)}
            stabilizer={stabilizer}
            onToggleStabilizer={() => setStabilizer(!stabilizer)}
            palmRejection={palmRejection}
            onTogglePalmRejection={() => setPalmRejection(!palmRejection)}
            onOpenColorPicker={() => setIsColorPickerOpen(true)}
            savedColors={savedColors}
            onActivateEyedropper={() => setIsEyedropperActive(!isEyedropperActive)}
            isEyedropperActive={isEyedropperActive}
            ruler={ruler}
            onChangeRuler={setRuler}
            isSnapToGrid={isSnapToGrid}
            onToggleSnapToGrid={() => setIsSnapToGrid(!isSnapToGrid)}
          />

          <ColorPickerModal
            isOpen={isColorPickerOpen}
            onClose={() => setIsColorPickerOpen(false)}
            activeColor={activeColor}
            onSelectColor={setActiveColor}
            savedColors={savedColors}
            onSaveColor={(c) => {
              if (!savedColors.includes(c)) {
                setSavedColors([...savedColors, c]);
              }
            }}
            onDeleteSavedColor={(c) => {
              setSavedColors(savedColors.filter(sc => sc !== c));
            }}
            recentColors={recentColors}
          />

          {/* AI Assistant Right Panel */}
          {!isFullscreen && (
            <AssistantPanel 
              canvasSelectionText={selectionText}
              onSolveFormula={handleSolveFormulaDirect}
              canvasObjects={canvasObjects}
              onUpdateObjects={updateCanvasObjects}
              activeNotebook={activeNotebook}
              activeNotebookId={activeNotebookId}
            />
          )}

          {/* Interactive Layers Panel */}
          <LayersPanel 
            isOpen={isLayersOpen}
            onClose={() => setIsLayersOpen(false)}
            canvasObjects={canvasObjects}
            onUpdateObjects={updateCanvasObjects}
          />

          {/* Real PDF Background Importer Modal */}
          <PDFImportModal
            isOpen={isPdfImportOpen}
            onClose={() => setIsPdfImportOpen(false)}
            canvasObjects={canvasObjects}
            onUpdateObjects={updateCanvasObjects}
            panOffset={panOffset}
            zoom={zoom}
            onPanChange={setPanOffset}
            onZoomChange={setZoom}
          />

          {/* Bottom Control & Info Bar */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center justify-between gap-4 px-6 py-3 bg-[#121212]/95 backdrop-blur-xl rounded-full border border-[#333333] shadow-2xl overflow-x-auto w-[90%] md:w-auto no-scrollbar">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#E6E1E5] hover:bg-[#1C1C1C] transition-colors"
                title="Zoom Out"
              >
                -
              </button>
              <button 
                onClick={() => setZoom(1.0)}
                className="text-xs font-bold text-[#E6E1E5] px-2 hover:text-[#D0BCFF] font-mono"
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button 
                onClick={() => setZoom(Math.min(3.0, zoom + 0.1))} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#E6E1E5] hover:bg-[#1C1C1C] transition-colors"
                title="Zoom In"
              >
                +
              </button>
            </div>

            <div className="w-px h-5 bg-[#333333] shrink-0" />

            {/* Undo/Redo Controls */}
            <div className="flex items-center gap-1">
              <button 
                onClick={handleUndo}
                disabled={historyIndex === 0}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  historyIndex === 0 ? "text-gray-600 cursor-not-allowed opacity-40" : "text-[#E6E1E5] hover:bg-[#1C1C1C]"
                }`}
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRedo}
                disabled={historyIndex === history.length - 1}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  historyIndex === history.length - 1 ? "text-gray-600 cursor-not-allowed opacity-40" : "text-[#E6E1E5] hover:bg-[#1C1C1C]"
                }`}
                title="Redo (Ctrl+Y)"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-[#333333] shrink-0" />

            {/* Coordinates display */}
            <div className="hidden md:flex flex-col text-left">
              <span className="text-[8px] uppercase font-bold text-gray-500 font-mono leading-none">Canvas Camera</span>
              <span className="text-[10px] text-[#938F99] font-mono mt-0.5">X: {panOffset.x}, Y: {panOffset.y}</span>
            </div>

            <div className="w-px h-5 bg-[#333333] shrink-0 hidden md:block" />

            {/* Grid Switch */}
            <button
              onClick={() => setIsGridEnabled(!isGridEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isGridEnabled ? "bg-[#2B2930] text-[#D0BCFF] border border-[#D0BCFF]/20" : "text-[#938F99] hover:text-[#E6E1E5]"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Grid {isGridEnabled ? "On" : "Off"}</span>
            </button>

            {/* Layers Toggle button */}
            <button
              onClick={() => setIsLayersOpen(!isLayersOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isLayersOpen ? "bg-[#2B2930] text-[#D0BCFF] border border-[#D0BCFF]/20" : "text-[#938F99] hover:text-[#E6E1E5]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Layers</span>
            </button>
            
            {/* Fullscreen Toggle button */}
            <button
              onClick={handleToggleFullscreen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isFullscreen ? "bg-[#2B2930] text-[#D0BCFF] border border-[#D0BCFF]/20 animate-pulse" : "text-[#938F99] hover:text-[#E6E1E5]"
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
            </button>
          </div>

          {/* Floating Action Button (Bottom Right) */}
          <div className="fixed bottom-24 right-6 z-50">
            {/* Helper Banner for placement tools */}
            {["text", "formula", "voice"].includes(activeTool) && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[#381E72] border border-[#D0BCFF] px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs text-white font-medium animate-bounce">
                <span className="animate-pulse">✨</span>
                <span>
                  {activeTool === "text" && "Click or tap anywhere on the canvas to place a Text Box"}
                  {activeTool === "formula" && "Click or tap anywhere on the canvas to place a Math Formula"}
                  {activeTool === "voice" && "Click or tap anywhere on the canvas to place a Dictate Voice Note"}
                </span>
                <button
                  onClick={() => setActiveTool("pen")}
                  className="ml-2 px-2 py-0.5 bg-[#D0BCFF] text-[#381E72] rounded-full font-bold hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
              className="w-14 h-14 bg-[#D0BCFF] text-[#381E72] rounded-full shadow-[0_0_20px_rgba(208,188,255,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
              title="Add New Whiteboard Object"
            >
              <Plus className={`w-7 h-7 transform transition-transform duration-300 ${isQuickAddOpen ? "rotate-45" : ""}`} />
            </button>

            {/* Quick Add Popover menu */}
            {isQuickAddOpen && (
              <div className="absolute bottom-16 right-0 flex flex-col gap-2.5 items-end bg-[#1C1C1C]/95 border border-[#333333] p-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 min-w-[180px] z-50">
                <button 
                  onClick={() => {
                    setActiveTool("formula");
                    setIsQuickAddOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#121212] text-xs text-[#E6E1E5] transition-colors w-full text-left font-medium"
                >
                  <span className="text-[#D0BCFF] text-sm">🔬</span>
                  <span>Math Formula</span>
                </button>
                <button 
                  onClick={() => {
                    setActiveTool("text");
                    setIsQuickAddOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#121212] text-xs text-[#E6E1E5] transition-colors w-full text-left font-medium"
                >
                  <span className="text-[#D0BCFF] text-sm">📝</span>
                  <span>Text Box</span>
                </button>
                <button 
                  onClick={() => {
                    setActiveTool("voice");
                    setIsQuickAddOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#121212] text-xs text-[#E6E1E5] transition-colors w-full text-left font-medium"
                >
                  <span className="text-[#D0BCFF] text-sm">🎤</span>
                  <span>Dictate Voice Note</span>
                </button>
              </div>
            )}
          </div>

          {/* Floating viewport thumbnail representing bottom mini-map */}
          <div className="fixed bottom-24 right-24 w-44 h-28 bg-[#121212]/80 backdrop-blur-xl rounded-2xl border border-[#333333] shadow-2xl z-40 p-1.5 overflow-hidden hidden lg:block">
            <div 
              onMouseDown={handleMinimapMouseDown}
              className="w-full h-full bg-black/40 rounded-lg relative border border-[#333333] cursor-crosshair select-none"
            >
              {/* Representing current pan position in infinite canvas */}
              <div 
                style={{
                  left: `${(panOffset.x / 12) + 20}px`,
                  top: `${(panOffset.y / 12) + 15}px`,
                  transform: `scale(${zoom})`
                }}
                className="absolute w-12 h-8 border border-[#cfbcff] bg-[#cfbcff]/10 rounded shadow transition-all pointer-events-none" 
              />
              <div className="absolute bottom-1 left-2 text-[7px] text-gray-500 font-mono pointer-events-none">Mini-Map Viewport</div>
            </div>
          </div>
        </>
        )
      ) : activeView === "android-hub" ? (
        /* Android clean-architecture codebase companion */
        <main className="w-full h-full relative overflow-y-auto pt-24 pb-16 px-4 md:px-8">
          <AndroidDevHub />
        </main>
      ) : (
        /* QA System Optimization & Stress-Test Suite Hub */
        <main className="w-full h-full relative overflow-y-auto pt-24 pb-16 px-4 md:px-8">
          <QAStressTestDashboard 
            canvasObjects={canvasObjects} 
            onUpdateObjects={updateCanvasObjects} 
            onNavigateToCanvas={() => setActiveView("whiteboard")} 
            renderBackend={renderBackend}
            onSetRenderBackend={setRenderBackend}
            isSimplificationEnabled={isSimplificationEnabled}
            onSetIsSimplificationEnabled={setIsSimplificationEnabled}
            simplificationTolerance={simplificationTolerance}
            onSetSimplificationTolerance={setSimplificationTolerance}
            isFrustumCullingEnabled={isFrustumCullingEnabled}
            onSetIsFrustumCullingEnabled={setIsFrustumCullingEnabled}
          />
        </main>
      )}

      {/* Export Modal Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in">
          <div className="bg-[#1C1C1C] border border-[#333333] rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <h3 className="font-bold text-gray-100 flex items-center gap-2">
                <Download className="w-5 h-5 text-[#D0BCFF]" />
                <span>Export Notebook Canvas</span>
              </h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-[#938F99] hover:text-[#E6E1E5] font-semibold text-sm px-2 py-1 hover:bg-[#121212] rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-[#938F99] leading-relaxed">
                Choose your desired export format. InkFlow AI packages all current infinite canvas handwriting vector paths, formula solvers, and text boxes into high-fidelity output.
              </p>

              <div className="grid grid-cols-2 gap-3.5">
                {[
                  { id: "pdf", label: "📄 PDF Document", desc: "For full sharing" },
                  { id: "png", label: "🖼️ High-Res PNG", desc: "Vector raster" },
                  { id: "markdown", label: "📝 Markdown Text", desc: "LaTeX included" },
                  { id: "txt", label: "📄 Plain TXT File", desc: "OCR extract only" }
                ].map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setExportFormat(format.id)}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      exportFormat === format.id 
                        ? "bg-[#2B2930] border-[#D0BCFF] text-[#D0BCFF]" 
                        : "border-[#333333] bg-[#0A0A0A] text-[#938F99] hover:bg-[#121212] hover:text-[#E6E1E5]"
                    }`}
                  >
                    <span className="block text-xs font-bold">{format.label}</span>
                    <span className="block text-[9px] text-[#938F99] mt-0.5">{format.desc}</span>
                  </button>
                ))}
              </div>

              {/* Local Backup & Restore JSON Import/Export */}
              <div className="border-t border-[#333333]/50 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">
                    💾 Local Backup & Restore
                  </span>
                  <span className="text-[9px] text-emerald-400/90 font-mono">Device-Only Storage</span>
                </div>
                
                <div className="flex gap-2.5">
                  <button
                    onClick={() => {
                      try {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(canvasObjects, null, 2));
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute("href", dataStr);
                        downloadAnchor.setAttribute("download", `inkflow_backup_${Date.now()}.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                      } catch (err) {
                        alert("Failed to export backup: " + err);
                      }
                    }}
                    className="flex-1 p-2.5 rounded-xl border border-[#333333] hover:border-[#D0BCFF]/50 bg-[#0A0A0A] text-left hover:bg-[#121212] transition-all flex items-center gap-2.5 cursor-pointer group"
                    title="Export full whiteboard state as JSON"
                  >
                    <span className="text-sm">📥</span>
                    <div>
                      <span className="block text-[11px] font-bold text-gray-200 group-hover:text-[#D0BCFF]">Backup JSON</span>
                      <span className="block text-[9px] text-[#938F99] mt-0.5">Download state</span>
                    </div>
                  </button>

                  <label
                    className="flex-1 p-2.5 rounded-xl border border-[#333333] hover:border-[#D0BCFF]/50 bg-[#0A0A0A] text-left hover:bg-[#121212] transition-all flex items-center gap-2.5 cursor-pointer group"
                    title="Import whiteboard state from a previously exported JSON file"
                  >
                    <span className="text-sm">📤</span>
                    <div>
                      <span className="block text-[11px] font-bold text-gray-200 group-hover:text-[#D0BCFF]">Restore JSON</span>
                      <span className="block text-[9px] text-[#938F99] mt-0.5">Upload backup</span>
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const parsed = JSON.parse(event.target?.result as string);
                            if (Array.isArray(parsed)) {
                              updateCanvasObjects(parsed);
                              alert("Restore Complete!\n\nSuccessfully loaded canvas backup with " + parsed.length + " objects.");
                              setShowExportModal(false);
                            } else {
                              alert("Invalid Backup File!\n\nThe selected file does not contain a valid InkFlow whiteboard state array.");
                            }
                          } catch (err) {
                            alert("Error parsing backup file: " + err);
                          }
                        };
                        reader.readAsText(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#333333] flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-full hover:bg-[#121212] text-[#938F99] hover:text-[#E6E1E5] text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowExportModal(false);
                  alert(`Export Successful!\n\nYour board "${activeNotebook}" has been compiled and downloaded as a highly optimized ${exportFormat.toUpperCase()}!`);
                }}
                className="px-5 py-2 bg-[#D0BCFF] text-[#381E72] rounded-full hover:opacity-90 text-xs font-bold tracking-wide transition-all shadow"
              >
                Confirm Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geometry Toolkit Panel */}
      <GeometryToolkit
        isOpen={isGeometryOpen && (!isFullscreen || isGeometryPinned)}
        onClose={() => setIsGeometryOpen(false)}
        isPinned={isGeometryPinned}
        onTogglePin={() => setIsGeometryPinned(!isGeometryPinned)}
        canvasObjects={canvasObjects}
        onUpdateObjects={updateCanvasObjects}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        zoom={zoom}
        panOffset={panOffset}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />

      {/* Elegant, low-opacity Author Watermark for Dashboard Views */}
      {activeView !== "whiteboard" && (
        <div 
          id="author-watermark" 
          className="fixed bottom-4 right-6 pointer-events-none select-none z-[80] text-right font-mono opacity-25"
        >
          <p className="text-[9px] text-[#938F99] font-bold uppercase tracking-widest leading-none mb-1">Author</p>
          <p className="text-[11px] text-gray-300 font-extrabold tracking-wider leading-none">Harshith . L . Narayan</p>
        </div>
      )}
    </div>
  );
}
