import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Save, Trash2, Edit2, Copy, Download, Upload, Check, RotateCcw } from "lucide-react";
import { CustomPalette } from "../types";

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeColor: string;
  onSelectColor: (color: string) => void;
  savedColors: string[];
  onSaveColor: (color: string) => void;
  onDeleteSavedColor: (color: string) => void;
  recentColors: string[];
}

// Preset Palettes
const PRESET_PALETTES: Record<string, string[]> = {
  Default: ["#FFFFFF", "#FFB4AB", "#D0BCFF", "#CCC2DC", "#86EFAC", "#7D33FC", "#7DD3FC", "#FCD34D", "#000000"],
  Pastel: ["#FFC6FF", "#BDB2FF", "#9BF6FF", "#CAFFBF", "#FDFFB6", "#FFD166", "#F28482", "#F6BD60", "#F5CAC3"],
  Neon: ["#39FF14", "#FF007F", "#00FFFF", "#FF00FF", "#FFFF00", "#FF5F1F", "#CCFF00", "#FF00CC", "#1F51FF"],
  Engineering: ["#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD", "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF"],
  Personal: ["#4A5568", "#2D3748", "#1A202C", "#3182CE", "#319795", "#38A169", "#D69E2E", "#E53E3E", "#D53F8C"]
};

export default function ColorPickerModal({
  isOpen,
  onClose,
  activeColor,
  onSelectColor,
  savedColors,
  onSaveColor,
  onDeleteSavedColor,
  recentColors
}: ColorPickerModalProps) {
  const [selectedPalette, setSelectedPalette] = useState<string>("Default");
  const [customPalettes, setCustomPalettes] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");

  // Main HSL/Alpha State
  const [hue, setHue] = useState(270);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(50);
  const [opacity, setOpacity] = useState(1);

  // HEX / RGB text inputs
  const [hexInput, setHexInput] = useState("#d0bcff");
  const [rgbInput, setRgbInput] = useState({ r: 208, g: 188, b: 255 });

  const colorWheelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Parse any selected color into State
  useEffect(() => {
    if (activeColor) {
      parseColor(activeColor);
    }
  }, [activeColor]);

  // Convert HEX/RGB/any color format to HSL and Alpha
  const parseColor = (colorStr: string) => {
    let clean = colorStr.trim();
    
    // Default fallback
    let r = 208, g = 188, b = 255, a = 1;

    // Is Hex
    if (clean.startsWith("#")) {
      const hex = clean.substring(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (hex.length === 8) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
        a = parseInt(hex.substring(6, 8), 16) / 255;
      }
    } else if (clean.startsWith("rgb")) {
      const match = clean.match(/\d+(\.\d+)?/g);
      if (match) {
        r = parseInt(match[0]);
        g = parseInt(match[1]);
        b = parseInt(match[2]);
        if (match[3]) {
          a = parseFloat(match[3]);
        }
      }
    }

    // Convert RGB to HSL
    let rNorm = r / 255;
    let gNorm = g / 255;
    let bNorm = b / 255;
    let max = Math.max(rNorm, gNorm, bNorm);
    let min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      h /= 6;
    }

    setHue(Math.round(h * 360));
    setSaturation(Math.round(s * 100));
    setBrightness(Math.round(l * 100));
    setOpacity(a);

    setHexInput(rgbToHex(r, g, b));
    setRgbInput({ r, g, b });
  };

  const getRgbaString = () => {
    const { r, g, b } = rgbInput;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const updateColorFromHsl = (h: number, s: number, l: number) => {
    // HSL to RGB
    let hNorm = h / 360;
    let sNorm = s / 100;
    let lNorm = l / 100;
    let r = 0, g = 0, b = 0;

    if (sNorm === 0) {
      r = g = b = lNorm; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      let q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      let p = 2 * lNorm - q;
      r = hue2rgb(p, q, hNorm + 1/3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1/3);
    }

    const rgb = {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };

    setRgbInput(rgb);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHexInput(hex);
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const clamp = (val: number) => Math.max(0, Math.min(255, val));
    const toHex = (val: number) => clamp(val).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Draw interactive color wheel canvas
  useEffect(() => {
    if (!isOpen || activeTab !== "custom") return;
    const canvas = colorWheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    // Draw HSV-based circular color wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 0.5) * Math.PI / 180;
      const endAngle = (angle + 0.5) * Math.PI / 180;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, "white");
      grad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Draw active indicator pin
    const angleRad = (hue * Math.PI) / 180;
    const distance = (saturation / 100) * radius;
    const indicatorX = cx + distance * Math.cos(angleRad);
    const indicatorY = cy + distance * Math.sin(angleRad);

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = "#121212";
    ctx.lineWidth = 2;
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.stroke();
  }, [hue, saturation, isOpen, activeTab]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasCoords(e);
  };

  const handleCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = colorWheelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    const sat = Math.min(100, Math.round((distance / radius) * 100));

    setHue(Math.round(angle));
    setSaturation(sat);
    updateColorFromHsl(Math.round(angle), sat, brightness);
  };

  const handleApplyColor = () => {
    const finalColor = getRgbaString();
    onSelectColor(finalColor);
    onClose();
  };

  const handleHexInputChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      parseColor(val);
    }
  };

  const handleRgbChange = (channel: "r" | "g" | "b", val: number) => {
    const clamped = Math.max(0, Math.min(255, val));
    const newRgb = { ...rgbInput, [channel]: clamped };
    setRgbInput(newRgb);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(hex);
    parseColor(hex);
  };

  // Preset palette list to draw
  const activePaletteColors = PRESET_PALETTES[selectedPalette] || [];

  const handleExportPalette = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activePaletteColors));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `inkflow_palette_${selectedPalette.toLowerCase()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportPalette = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const colors = JSON.parse(event.target?.result as string);
        if (Array.isArray(colors)) {
          // Save under custom import palette
          setCustomPalettes(prev => ({
            ...prev,
            "Imported Palette": colors
          }));
          setSelectedPalette("Imported Palette");
        }
      } catch (err) {
        alert("Failed to import palette. Make sure it's a valid JSON array.");
      }
    };
    reader.readAsText(file);
  };

  // Context Menu state for Custom Saved Colors
  const [contextColor, setContextColor] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleColorContextMenu = (e: React.MouseEvent, color: string) => {
    e.preventDefault();
    setContextColor(color);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-[#333333] shadow-2xl rounded-[1.75rem] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] text-[#E6E1E5] animate-in fade-in scale-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#2A2A2A]">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getRgbaString() }} />
              Material 3 Color Studio
            </h3>
            <span className="text-[10px] text-[#938F99] font-mono mt-0.5">Custom color profile compiler</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#1C1C1C] text-[#938F99] hover:text-[#E6E1E5]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex px-4 py-2 gap-2 border-b border-[#2A2A2A] bg-[#0A0A0A]/40">
          <button
            onClick={() => setActiveTab("presets")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "presets" ? "bg-[#2B2930] text-[#D0BCFF] border border-[#D0BCFF]/20" : "text-[#938F99] hover:text-white"
            }`}
          >
            🎨 Palettes & Presets
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "custom" ? "bg-[#2B2930] text-[#D0BCFF] border border-[#D0BCFF]/20" : "text-[#938F99] hover:text-white"
            }`}
          >
            🎡 HSL Vector Wheel
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          
          {/* Visual Canvas Wheel or Preset List */}
          {activeTab === "presets" ? (
            <div className="space-y-4.5">
              
              {/* Palette Select Dropdown */}
              <div className="flex items-center justify-between gap-3 bg-[#1C1C1C] p-2.5 rounded-xl border border-[#333333]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Current Theme</span>
                  <select
                    value={selectedPalette}
                    onChange={(e) => {
                      setSelectedPalette(e.target.value);
                    }}
                    className="bg-[#121212] text-xs font-semibold text-[#D0BCFF] border-none outline-none mt-1 cursor-pointer pr-4"
                  >
                    <option value="Default">Default Material 3</option>
                    <option value="Pastel">Pastel Play</option>
                    <option value="Neon">High contrast Neon</option>
                    <option value="Engineering">Engineering Plotly</option>
                    <option value="Personal">Personal Slate</option>
                    {customPalettes["Imported Palette"] && <option value="Imported Palette">Imported Palette</option>}
                  </select>
                </div>
                
                {/* Export/Import triggers */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleExportPalette}
                    className="p-2 rounded-lg bg-[#121212] border border-[#333333] text-[#938F99] hover:text-[#E6E1E5]"
                    title="Export Current Palette"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <label className="p-2 rounded-lg bg-[#121212] border border-[#333333] text-[#938F99] hover:text-[#E6E1E5] cursor-pointer" title="Import Palette (JSON)">
                    <Upload className="w-3.5 h-3.5" />
                    <input type="file" onChange={handleImportPalette} className="hidden" accept=".json" />
                  </label>
                </div>
              </div>

              {/* Grid Layout of Selected Palette */}
              <div className="grid grid-cols-5 gap-3">
                {(customPalettes[selectedPalette] || PRESET_PALETTES[selectedPalette] || []).map((color, idx) => {
                  const isActive = activeColor.toLowerCase().includes(color.toLowerCase());
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        parseColor(color);
                        onSelectColor(color);
                      }}
                      style={{ backgroundColor: color }}
                      className={`h-10 rounded-xl border border-black/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center relative group`}
                    >
                      {isActive && <Check className="w-4 h-4 text-black bg-white/70 rounded-full p-0.5" />}
                    </button>
                  );
                })}
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* circular interactive wheel canvas */}
              <div className="relative">
                <canvas
                  ref={colorWheelCanvasRef}
                  width={180}
                  height={180}
                  onMouseDown={handleCanvasMouseDown}
                  className="rounded-full cursor-crosshair border border-[#333333]"
                />
              </div>

              {/* Interactive Sliders */}
              <div className="w-full space-y-3.5">
                {/* Brightness/Lightness Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-[#938F99]">
                    <span>BRIGHTNESS</span>
                    <span>{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={brightness}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBrightness(val);
                      updateColorFromHsl(hue, saturation, val);
                    }}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#D0BCFF] bg-gradient-to-r from-black via-gray-400 to-white"
                  />
                </div>

                {/* Opacity/Alpha Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-[#938F99]">
                    <span>OPACITY (ALPHA)</span>
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={opacity * 100}
                    onChange={(e) => {
                      setOpacity(Number(e.target.value) / 100);
                    }}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#D0BCFF] bg-gradient-to-r from-transparent to-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* HEX and RGB Exact Input Fields */}
          <div className="bg-[#0A0A0A]/60 p-4 rounded-2xl border border-[#2A2A2A] grid grid-cols-12 gap-3.5 items-center">
            
            {/* Live Preview block */}
            <div className="col-span-3 flex flex-col items-center gap-1">
              <div
                style={{ backgroundColor: getRgbaString() }}
                className="w-12 h-12 rounded-xl border border-[#333333] shadow-inner"
              />
              <span className="text-[9px] text-[#938F99] font-mono font-bold">PREVIEW</span>
            </div>

            {/* HEX input */}
            <div className="col-span-5 flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-[#938F99] font-mono">HEX CODE</label>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexInputChange(e.target.value)}
                placeholder="#D0BCFF"
                className="bg-[#121212] border border-[#333333] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[#D0BCFF] transition-colors"
              />
            </div>

            {/* RGB Input channels */}
            <div className="col-span-4 flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-[#938F99] font-mono">RGB CHANNELS</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgbInput.r}
                  onChange={(e) => handleRgbChange("r", parseInt(e.target.value) || 0)}
                  className="w-full bg-[#121212] border border-[#333333] rounded-lg p-1 text-[11px] text-center font-mono outline-none text-[#ffb4ab]"
                  title="Red"
                />
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgbInput.g}
                  onChange={(e) => handleRgbChange("g", parseInt(e.target.value) || 0)}
                  className="w-full bg-[#121212] border border-[#333333] rounded-lg p-1 text-[11px] text-center font-mono outline-none text-[#86efac]"
                  title="Green"
                />
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgbInput.b}
                  onChange={(e) => handleRgbChange("b", parseInt(e.target.value) || 0)}
                  className="w-full bg-[#121212] border border-[#333333] rounded-lg p-1 text-[11px] text-center font-mono outline-none text-[#7dd3fc]"
                  title="Blue"
                />
              </div>
            </div>

          </div>

          {/* Recently Used and Custom Saved Swatches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">My Saved Colors</span>
              <button
                onClick={() => onSaveColor(getRgbaString())}
                className="flex items-center gap-1 text-[10px] text-[#D0BCFF] font-bold hover:underline"
              >
                <Plus className="w-3 h-3" />
                <span>Save to Swatches</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 min-h-[30px] p-2 bg-[#0A0A0A]/30 rounded-xl border border-[#2A2A2A]">
              {savedColors.length === 0 ? (
                <span className="text-[10px] text-[#938F99] italic px-1">No custom swatches saved yet. Click above to save this color.</span>
              ) : (
                savedColors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      parseColor(color);
                      onSelectColor(color);
                    }}
                    onContextMenu={(e) => handleColorContextMenu(e, color)}
                    style={{ backgroundColor: color }}
                    className="w-6.5 h-6.5 rounded-full border border-black/20 hover:scale-110 active:scale-95 transition-transform relative"
                    title="Right click / hold for action"
                  >
                    {activeColor === color && (
                      <span className="absolute inset-0 border-2 border-white rounded-full scale-75" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Recent list */}
          {recentColors.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Recently Used Swatches</span>
              <div className="flex flex-wrap gap-2">
                {recentColors.slice(0, 10).map((color, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      parseColor(color);
                      onSelectColor(color);
                    }}
                    style={{ backgroundColor: color }}
                    className="w-5.5 h-5.5 rounded-full border border-black/20 hover:scale-110 transition-transform"
                  />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div className="p-4 bg-[#1C1C1C] border-t border-[#2A2A2A] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4.5 py-2 bg-transparent text-[#938F99] hover:text-[#E6E1E5] text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyColor}
            className="px-5 py-2 bg-[#D0BCFF] text-[#381E72] rounded-full hover:bg-opacity-90 text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            Apply Active Color
          </button>
        </div>

      </div>

      {/* Custom Context Menu overlay for Saved Swatches */}
      {contextColor && (
        <div
          className="fixed inset-0 z-[110] bg-transparent"
          onClick={() => setContextColor(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextColor(null);
          }}
        >
          <div
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            className="absolute bg-[#1C1C1C] border border-[#333333] shadow-2xl rounded-xl p-1 w-36 z-[120] text-xs"
          >
            <button
              onClick={() => {
                onDeleteSavedColor(contextColor);
                setContextColor(null);
              }}
              className="w-full text-left px-2.5 py-1.5 text-red-400 hover:bg-[#333333] rounded-lg flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete swatch</span>
            </button>
            <button
              onClick={() => {
                onSaveColor(contextColor); // duplicates
                setContextColor(null);
              }}
              className="w-full text-left px-2.5 py-1.5 text-gray-200 hover:bg-[#333333] rounded-lg flex items-center gap-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
