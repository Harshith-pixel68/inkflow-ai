import React, { useState, useRef, useEffect } from "react";
import { 
  X, Upload, FileText, Check, AlertCircle, 
  HelpCircle, Loader2, LayoutGrid, LayoutList, 
  Sliders, ArrowRight, Eye, ShieldAlert
} from "lucide-react";
import { CanvasObject } from "../types";

interface PDFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasObjects: CanvasObject[];
  onUpdateObjects: (objs: CanvasObject[], pushHistory?: boolean) => void;
  panOffset: { x: number; y: number };
  zoom: number;
  onPanChange: (offset: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
}

// Dynamically inject PDF.js library from CDN
function loadPdfJS(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js library. Check internet connectivity."));
    document.head.appendChild(script);
  });
}

export default function PDFImportModal({
  isOpen,
  onClose,
  canvasObjects,
  onUpdateObjects,
  panOffset,
  zoom,
  onPanChange,
  onZoomChange
}: PDFImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageRangeMode, setPageRangeMode] = useState<"all" | "custom">("all");
  const [customRange, setCustomRange] = useState<string>("1-3");
  const [layoutMode, setLayoutMode] = useState<"vertical" | "horizontal" | "grid">("vertical");
  const [qualityScale, setQualityScale] = useState<number>(1.5); // 1.0 (fast), 1.5 (standard), 2.0 (high)
  const [lockBackgrounds, setLockBackgrounds] = useState<boolean>(true); // Locked by default for annotation
  const [opacity, setOpacity] = useState<number>(1.0); // Opacity of background layers
  
  // Processing States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [renderProgress, setRenderProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear states when closing
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPdfDoc(null);
      setTotalPages(0);
      setIsLoading(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle PDF file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setErrorMessage("Please select a valid PDF document file (.pdf).");
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setIsLoading(true);
    setLoadingStep("Loading PDF Document Engine...");

    try {
      const pdfjsLib = await loadPdfJS();
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const doc = await loadingTask.promise;
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCustomRange(`1-${Math.min(5, doc.numPages)}`);
          setIsLoading(false);
        } catch (err: any) {
          console.error(err);
          setErrorMessage(`PDF parsing failed: ${err.message || err}`);
          setIsLoading(false);
          setFile(null);
        }
      };

      reader.onerror = () => {
        setErrorMessage("File reading error. Please try again.");
        setIsLoading(false);
        setFile(null);
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to load PDF library. Ensure you are online.");
      setIsLoading(false);
      setFile(null);
    }
  };

  // Parse page range input string (e.g. "1, 2-4, 7")
  const parseRangeString = (rangeStr: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const parts = rangeStr.split(",");
    
    for (const part of parts) {
      const clean = part.trim();
      if (clean.includes("-")) {
        const [startStr, endStr] = clean.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(maxPages, Math.max(start, end));
          for (let i = min; i <= max; i++) {
            pages.add(i);
          }
        }
      } else {
        const page = parseInt(clean, 10);
        if (!isNaN(page) && page >= 1 && page <= maxPages) {
          pages.add(page);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  // Convert rendered PDF pages to CanvasObjects and inject into the Board
  const handleImportPDF = async () => {
    if (!pdfDoc) return;

    setIsLoading(true);
    setErrorMessage(null);

    // 1. Determine list of pages to import
    let pagesToImport: number[] = [];
    if (pageRangeMode === "all") {
      pagesToImport = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      pagesToImport = parseRangeString(customRange, totalPages);
    }

    if (pagesToImport.length === 0) {
      setErrorMessage("No valid page numbers found in specified range.");
      setIsLoading(false);
      return;
    }

    setRenderProgress({ current: 0, total: pagesToImport.length });

    try {
      const importedObjects: CanvasObject[] = [];
      
      // We will place imported documents relative to the center of the viewport
      // Viewport width/height can be estimated at 1000px
      const baseViewportX = -panOffset.x / zoom + (1000 / zoom) / 2;
      const baseViewportY = -panOffset.y / zoom + (600 / zoom) / 2;

      let currentX = baseViewportX - 300; // Place standard letter center
      let currentY = baseViewportY - 200;

      // Track layout positions
      const gap = 32; // pixel separation between page layers
      let maxPageWidth = 0;
      let totalLayoutHeight = 0;

      for (let i = 0; i < pagesToImport.length; i++) {
        const pageNum = pagesToImport[i];
        setLoadingStep(`Rendering page ${pageNum} (${i + 1}/${pagesToImport.length})...`);
        setRenderProgress({ current: i + 1, total: pagesToImport.length });

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: qualityScale });

        // Create a canvas to render the page to an image
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas 2D rendering context.");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Ensure white solid background for papers
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
          background: "white"
        };

        await page.render(renderContext).promise;
        const dataUrl = canvas.toDataURL("image/png");

        // Scale coordinates back to canonical canvas space
        // Let's standardise display sizes (e.g. Fit to ~700px width for letter/A4)
        const displayWidth = 700;
        const displayHeight = (viewport.height / viewport.width) * displayWidth;

        // Position based on layoutMode selection
        let posX = currentX;
        let posY = currentY;

        if (layoutMode === "vertical") {
          posX = currentX;
          posY = currentY + i * (displayHeight + gap);
        } else if (layoutMode === "horizontal") {
          posX = currentX + i * (displayWidth + gap);
          posY = currentY;
        } else if (layoutMode === "grid") {
          const col = i % 2;
          const row = Math.floor(i / 2);
          posX = currentX + col * (displayWidth + gap);
          posY = currentY + row * ((displayWidth * 1.41) + gap); // typical A4 ratio height
        }

        const newObj: CanvasObject = {
          id: `pdf-page-${Date.now()}-${pageNum}-${Math.random().toString(36).substr(2, 4)}`,
          type: "image",
          x: posX,
          y: posY,
          width: displayWidth,
          height: displayHeight,
          rotation: 0,
          layer: 0, // bottom level background layers
          createdAt: Date.now() + i, // sequential layering
          updatedAt: Date.now() + i,
          color: "#FFFFFF",
          strokeWidth: 1,
          imageUrl: dataUrl,
          isLocked: lockBackgrounds, // Lock is true by default for annotation
          opacity: opacity,
          name: `${file?.name || "Document"}_Page_${pageNum}`
        };

        importedObjects.push(newObj);
      }

      // Add to main canvas objects
      onUpdateObjects([...canvasObjects, ...importedObjects], true);

      // Focus pan/zoom to center first imported page
      if (importedObjects.length > 0) {
        const first = importedObjects[0];
        // Centered pan target offset
        const targetPanX = 1000/2 - (first.x + first.width/2) * zoom;
        const targetPanY = 600/2 - (first.y + first.height/2) * zoom;
        onPanChange({ x: targetPanX, y: targetPanY });
      }

      setIsLoading(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Failed rendering page layers: ${err.message || err}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] animate-fade-in p-4">
      <div className="bg-[#121212] border border-[#333333] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333] bg-[#1C1C1C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100 font-mono">IMPORT PDF DOCUMENT</h3>
              <p className="text-[10px] text-[#938F99] font-mono uppercase tracking-wider">Vectorized Background Layer Engine</p>
            </div>
          </div>
          <button 
            disabled={isLoading}
            onClick={onClose} 
            className="p-1.5 text-[#938F99] hover:text-[#E6E1E5] hover:bg-white/5 rounded-full transition-all disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          
          {errorMessage && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2.5 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div>
                <span className="font-bold">Error:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* 1. File Upload Dropzone (When no doc selected) */}
          {!pdfDoc && !isLoading && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#333333] hover:border-[#D0BCFF] bg-[#1C1C1C]/50 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-[#1C1C1C]/90 flex flex-col items-center gap-3.5 group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept="application/pdf"
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-[#121212] border border-[#333333] group-hover:border-[#D0BCFF]/50 flex items-center justify-center text-[#938F99] group-hover:text-[#D0BCFF] transition-all">
                <Upload className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-200">Drag & drop your engineering PDF here</p>
                <p className="text-[11px] text-[#938F99]">or click to browse local computer files</p>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                Support slides, exam papers, textbooks
              </span>
            </div>
          )}

          {/* 2. Loading State with Progress Bar */}
          {isLoading && (
            <div className="py-8 text-center space-y-4">
              <div className="flex justify-center">
                <Loader2 className="w-8 h-8 text-[#D0BCFF] animate-spin" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-300 font-mono">{loadingStep}</p>
                {renderProgress.total > 0 && (
                  <div className="w-full max-w-xs mx-auto space-y-1">
                    <div className="h-1.5 w-full bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#D0BCFF] to-[#b39ddb] rounded-full transition-all duration-300"
                        style={{ width: `${(renderProgress.current / renderProgress.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Page progress: {renderProgress.current} / {renderProgress.total} ({Math.round((renderProgress.current / renderProgress.total) * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Document Import Options Form (When document successfully parsed) */}
          {pdfDoc && !isLoading && (
            <div className="space-y-5">
              
              {/* Document Overview Header */}
              <div className="p-3 bg-[#1C1C1C] rounded-xl border border-[#333333] flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileText className="w-4 h-4 text-[#D0BCFF] shrink-0" />
                  <span className="text-xs font-bold text-gray-200 truncate font-mono max-w-[240px]">
                    {file?.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-[#332D41] text-[#D0BCFF] rounded-md shrink-0 border border-[#D0BCFF]/10">
                  {totalPages} {totalPages === 1 ? "PAGE" : "PAGES"} LOADED
                </span>
              </div>

              {/* Page Range Selectors */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 font-mono block">PAGE EXTRACTION SCOPE</label>
                <div className="grid grid-cols-2 gap-3 bg-[#1C1C1C] p-1.5 rounded-xl border border-[#333333]">
                  <button
                    onClick={() => setPageRangeMode("all")}
                    className={`py-2 text-center text-xs font-semibold rounded-lg font-mono transition-all ${
                      pageRangeMode === "all" 
                        ? "bg-[#D0BCFF] text-[#381E72] font-bold shadow-md" 
                        : "text-[#938F99] hover:text-[#E6E1E5]"
                    }`}
                  >
                    All Pages ({totalPages})
                  </button>
                  <button
                    onClick={() => setPageRangeMode("custom")}
                    className={`py-2 text-center text-xs font-semibold rounded-lg font-mono transition-all ${
                      pageRangeMode === "custom" 
                        ? "bg-[#D0BCFF] text-[#381E72] font-bold shadow-md" 
                        : "text-[#938F99] hover:text-[#E6E1E5]"
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {pageRangeMode === "custom" && (
                  <div className="space-y-1.5 pt-1">
                    <input 
                      type="text"
                      value={customRange}
                      onChange={(e) => setCustomRange(e.target.value)}
                      placeholder="e.g. 1, 3-5, 8"
                      className="w-full bg-[#1C1C1C] border border-[#333333] hover:border-gray-600 focus:border-[#D0BCFF] text-xs font-mono text-gray-200 rounded-xl px-3 py-2.5 outline-none transition-colors"
                    />
                    <span className="text-[10px] text-[#938F99] block font-mono">
                      Use commas and dashes to delineate page numbers (e.g., 1, 2-4)
                    </span>
                  </div>
                )}
              </div>

              {/* Tiling Layout Configuration */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 font-mono block">BACKGROUND LAYOUT TILING</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setLayoutMode("vertical")}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      layoutMode === "vertical" 
                        ? "border-[#D0BCFF] bg-[#D0BCFF]/10 text-[#D0BCFF]" 
                        : "border-[#333333] bg-[#1C1C1C]/40 text-[#938F99] hover:border-gray-700 hover:text-gray-200"
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                    <span className="text-[10px] font-bold font-mono">Vertical Scroll</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode("horizontal")}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      layoutMode === "horizontal" 
                        ? "border-[#D0BCFF] bg-[#D0BCFF]/10 text-[#D0BCFF]" 
                        : "border-[#333333] bg-[#1C1C1C]/40 text-[#938F99] hover:border-gray-700 hover:text-gray-200"
                    }`}
                  >
                    <LayoutList className="w-4 h-4 rotate-90" />
                    <span className="text-[10px] font-bold font-mono">Horizontal Grid</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode("grid")}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      layoutMode === "grid" 
                        ? "border-[#D0BCFF] bg-[#D0BCFF]/10 text-[#D0BCFF]" 
                        : "border-[#333333] bg-[#1C1C1C]/40 text-[#938F99] hover:border-gray-700 hover:text-gray-200"
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-[10px] font-bold font-mono">2-Column bento</span>
                  </button>
                </div>
              </div>

              {/* Advanced Configurations Panel */}
              <div className="p-4 bg-[#1C1C1C] border border-[#333333] rounded-2xl space-y-4">
                <span className="text-xs font-bold text-[#D0BCFF] uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#D0BCFF]" /> Advanced Engine Presets
                </span>

                {/* Annotation Shield Lock Toggle */}
                <div className="flex items-center justify-between border-b border-[#333333] pb-3">
                  <div>
                    <span className="text-xs font-bold text-gray-200 block mb-0.5">Secure Canvas Anchor Lock</span>
                    <span className="text-[10px] text-[#938F99] leading-tight block font-mono">
                      Prevents mouse selection/drags of page so you can draw smoothly on top.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={lockBackgrounds}
                    onChange={(e) => setLockBackgrounds(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-[#333333] text-indigo-600 focus:ring-indigo-500 bg-[#121212] cursor-pointer accent-[#D0BCFF]"
                  />
                </div>

                {/* Quality / Resolution DPI Scale Factor */}
                <div className="flex items-center justify-between border-b border-[#333333] pb-3">
                  <div>
                    <span className="text-xs font-bold text-gray-200 block mb-0.5">Render Quality (Resolution)</span>
                    <span className="text-[10px] text-[#938F99] leading-tight block font-mono">
                      Higher quality renders crisp math formulas but consumes more GPU ram.
                    </span>
                  </div>
                  <select
                    value={qualityScale}
                    onChange={(e) => setQualityScale(parseFloat(e.target.value))}
                    className="bg-[#121212] border border-[#333333] text-xs font-mono text-gray-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="1.0">Low (72 DPI)</option>
                    <option value="1.5">Standard (110 DPI)</option>
                    <option value="2.0">High (150 DPI)</option>
                    <option value="3.0">Ultra-HD (220 DPI)</option>
                  </select>
                </div>

                {/* Image opacity layer slide */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-200 block mb-0.5">Layer Transparency Opacity</span>
                      <span className="text-[10px] text-[#938F99] leading-tight block font-mono">
                        Dim backgrounds down to make handwritten notes pop beautifully.
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#D0BCFF]">
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#121212] rounded-lg appearance-none cursor-pointer accent-[#D0BCFF]"
                  />
                </div>
              </div>

              {/* Secure Annotation Notice Banner */}
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex gap-2 text-[11px] text-indigo-300 font-mono">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-400 animate-pulse" />
                <span>
                  The imported document pages will sit perfectly anchored at bottom of your vector layers. Switch to <b className="text-indigo-200">Pen ( stylus drawing )</b> to begin notes annotations.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#333333] bg-[#1C1C1C] flex justify-between gap-3">
          {pdfDoc && !isLoading ? (
            <button
              onClick={() => {
                setPdfDoc(null);
                setFile(null);
              }}
              className="px-4 py-2 bg-[#333333] hover:bg-[#444444] text-[#E6E1E5] text-xs font-semibold rounded-xl transition-all font-mono active:scale-95"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2 hover:bg-white/5 text-[#938F99] hover:text-[#E6E1E5] text-xs font-semibold rounded-xl transition-all font-mono disabled:opacity-30"
            >
              Cancel
            </button>

            {pdfDoc && !isLoading && (
              <button
                onClick={handleImportPDF}
                className="px-5 py-2 bg-gradient-to-r from-[#D0BCFF] to-[#b39ddb] text-[#381E72] hover:scale-105 transition-all text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 font-mono active:scale-95"
              >
                <span>Import Pages</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
