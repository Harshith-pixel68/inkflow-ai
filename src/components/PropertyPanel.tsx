import React from "react";
import { Plus, Pipette } from "lucide-react";
import { RulerState } from "../types";
import { getHapticSetting, setHapticSetting, HapticStrength, triggerHaptic } from "../utils/haptics";

interface PropertyPanelProps {
  activeColor: string;
  onChangeColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
  pressureSensitive: boolean;
  onTogglePressure: () => void;
  stabilizer: boolean;
  onToggleStabilizer: () => void;
  palmRejection: boolean;
  onTogglePalmRejection: () => void;
  onOpenColorPicker: () => void;
  savedColors: string[];
  onActivateEyedropper: () => void;
  isEyedropperActive: boolean;
  ruler: RulerState;
  onChangeRuler: (ruler: RulerState) => void;
  isSnapToGrid: boolean;
  onToggleSnapToGrid: () => void;
}

export default function PropertyPanel({
  activeColor,
  onChangeColor,
  strokeWidth,
  onChangeStrokeWidth,
  pressureSensitive,
  onTogglePressure,
  stabilizer,
  onToggleStabilizer,
  palmRejection,
  onTogglePalmRejection,
  onOpenColorPicker,
  savedColors,
  onActivateEyedropper,
  isEyedropperActive,
  ruler,
  onChangeRuler,
  isSnapToGrid,
  onToggleSnapToGrid,
}: PropertyPanelProps) {
  const [hapticSetting, setHapticSettingState] = React.useState<HapticStrength>(getHapticSetting());

  const handleHapticChange = (val: HapticStrength) => {
    setHapticSetting(val);
    setHapticSettingState(val);
    if (val !== "off") {
      triggerHaptic(20);
    }
  };

  const defaultColors = [
    { value: "#ffffff", name: "White" },
    { value: "#ffb4ab", name: "Light Red" },
    { value: "#d0bcff", name: "Lavender" },
    { value: "#ccc2dc", name: "Grey" },
    { value: "#86efac", name: "Green" },
    { value: "#7dd3fc", name: "Sky Blue" },
    { value: "#fcd34d", name: "Yellow" },
  ];

  // Combine default with up to 4 custom saved colors
  const quickColors = [
    ...defaultColors,
    ...savedColors.slice(0, 4).map(c => ({ value: c, name: "Custom" }))
  ].slice(0, 11); // Max 11 quick colors

  return (
    <div className="fixed left-20 top-1/2 -translate-y-1/2 z-40 bg-[#121212]/95 backdrop-blur-2xl rounded-3xl border border-[#333333] shadow-2xl p-4 flex flex-col gap-4 w-52 max-h-[85vh] overflow-y-auto no-scrollbar">
      {/* Colors */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Color Palette</span>
          
          {/* Eyedropper tool quick trigger */}
          <button
            onClick={onActivateEyedropper}
            className={`p-1 rounded-md transition-colors ${
              isEyedropperActive 
                ? "bg-[#D0BCFF] text-[#381E72] font-bold" 
                : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
            }`}
            title="Pick color from canvas elements"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5 mt-1">
          {quickColors.map((color, index) => {
            const isActive = activeColor.toLowerCase() === color.value.toLowerCase();
            return (
              <button
                key={`${color.value}-${index}`}
                onClick={() => onChangeColor(color.value)}
                style={{ backgroundColor: color.value }}
                className={`w-6 h-6 rounded-full border border-black/20 hover:scale-110 active:scale-95 transition-transform ${
                  isActive ? "ring-2 ring-[#D0BCFF] ring-offset-2 ring-offset-[#121212]" : ""
                }`}
                title={color.name}
              />
            );
          })}
          
          {/* Custom color trigger */}
          <button
            onClick={onOpenColorPicker}
            className="w-6 h-6 rounded-full flex items-center justify-center border border-[#333333] hover:bg-[#1C1C1C] text-white transition-colors"
            title="Open Color Studio"
          >
            <Plus className="w-3.5 h-3.5 text-[#D0BCFF]" />
          </button>
        </div>
      </div>


      <div className="w-full h-px bg-[#333333]" />

      {/* Stroke Width Slider */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Stroke Size ({strokeWidth}px)</span>
        <div className="flex items-center justify-between gap-2.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#938F99] shrink-0" />
          <input
            type="range"
            min="1"
            max="12"
            value={strokeWidth}
            onChange={(e) => onChangeStrokeWidth(Number(e.target.value))}
            className="w-full h-1 bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#D0BCFF]"
          />
          <div className="w-3.5 h-3.5 rounded-full bg-[#938F99] shrink-0" />
        </div>
      </div>

      <div className="w-full h-px bg-[#333333]" />

      {/* Settings Switched */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Stylus Settings</span>

        {/* Pressure Sensitivity */}
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-xs text-[#E6E1E5] group-hover:text-[#D0BCFF] transition-colors">Pressure Sense</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={pressureSensitive}
              onChange={onTogglePressure}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#938F99] after:border-transparent after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#D0BCFF] peer-checked:after:bg-[#381E72]" />
          </div>
        </label>

        {/* Stabilizer */}
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-xs text-[#E6E1E5] group-hover:text-[#D0BCFF] transition-colors">Path Stabilizer</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={stabilizer}
              onChange={onToggleStabilizer}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#938F99] after:border-transparent after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#D0BCFF] peer-checked:after:bg-[#381E72]" />
          </div>
        </label>

        {/* Palm Rejection */}
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-xs text-[#E6E1E5] group-hover:text-[#D0BCFF] transition-colors">Palm Reject</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={palmRejection}
              onChange={onTogglePalmRejection}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#938F99] after:border-transparent after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#D0BCFF] peer-checked:after:bg-[#381E72]" />
          </div>
        </label>
      </div>

      <div className="w-full h-px bg-[#333333]" />

      {/* Advanced Drafting Ruler Section */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Drafting Ruler</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${ruler.isActive ? "bg-emerald-500/10 text-emerald-400 font-bold" : "bg-red-500/10 text-red-400"}`}>
            {ruler.isActive ? "ACTIVE" : "OFF"}
          </span>
        </div>

        {/* Ruler Active Toggle */}
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-xs text-[#E6E1E5] group-hover:text-[#D0BCFF] transition-colors">Show Ruler</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={ruler.isActive}
              onChange={() => onChangeRuler({ ...ruler, isActive: !ruler.isActive })}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#938F99] after:border-transparent after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#D0BCFF] peer-checked:after:bg-[#381E72]" />
          </div>
        </label>

        {ruler.isActive && (
          <div className="space-y-2 mt-1 bg-[#1C1C1C]/40 p-2 rounded-xl border border-[#333333]/40">
            {/* Snap Drawing */}
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-[11px] text-[#C4C0C5] group-hover:text-[#D0BCFF] transition-colors">Snap Pen</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={ruler.isSnapMode}
                  onChange={() => onChangeRuler({ ...ruler, isSnapMode: !ruler.isSnapMode })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#938F99] after:border-transparent after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#D0BCFF] peer-checked:after:bg-[#381E72]" />
              </div>
            </label>

            {/* Lock/Unlock */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-[#C4C0C5]">Rotation Lock</span>
              <button
                onClick={() => onChangeRuler({ ...ruler, isLocked: !ruler.isLocked })}
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  ruler.isLocked 
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" 
                    : "bg-[#2A2A2A] text-[#938F99] hover:bg-[#333333] hover:text-[#E6E1E5]"
                }`}
              >
                {ruler.isLocked ? "🔒 Locked" : "🔓 Unlocked"}
              </button>
            </div>

            {/* Opacity slider */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-[#333333]/20">
              <span className="text-[9px] text-[#938F99] uppercase font-mono">Opacity ({Math.round(ruler.opacity * 100)}%)</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={ruler.opacity}
                onChange={(e) => onChangeRuler({ ...ruler, opacity: Number(e.target.value) })}
                className="w-full h-0.5 bg-[#333333] rounded appearance-none cursor-pointer accent-[#D0BCFF]"
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-full h-px bg-[#333333]" />

      {/* Grid Settings Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Grid Settings</span>
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-xs text-[#E6E1E5] group-hover:text-[#D0BCFF] transition-colors">Snap to Grid</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={isSnapToGrid}
              onChange={onToggleSnapToGrid}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#938F99] after:border-transparent after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#D0BCFF] peer-checked:after:bg-[#381E72]" />
          </div>
        </label>
      </div>

      <div className="w-full h-px bg-[#333333]" />

      {/* Haptic Feedback Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase font-bold text-[#938F99] tracking-wider font-mono">Haptic Feedback</span>
        <div className="grid grid-cols-2 gap-1 bg-[#1C1C1C] p-1 rounded-xl border border-[#333333]/40">
          {(["off", "light", "normal", "strong"] as HapticStrength[]).map((strength) => (
            <button
              key={strength}
              onClick={() => handleHapticChange(strength)}
              className={`py-1 text-[9px] uppercase font-bold rounded-md font-mono transition-colors cursor-pointer ${
                hapticSetting === strength
                  ? "bg-[#D0BCFF] text-[#381E72]"
                  : "text-[#938F99] hover:bg-[#2B2930] hover:text-[#E6E1E5]"
              }`}
            >
              {strength}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
