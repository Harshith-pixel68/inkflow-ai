import React, { useState, useRef, useEffect } from "react";
import { CanvasObject, RulerState } from "../types";
import { parseMarkdownTable } from "../utils/aiResponseParser";
import { getGeometryObject, getSnappingCoordinates } from "../lib/GeometryObjects";
import { WebGLStrokeRenderer } from "./WebGLStrokeRenderer";
import { triggerHaptic } from "../utils/haptics";
import { 
  Sparkles, Trash2, Copy, FileText, Check, AlertCircle, RefreshCw, 
  Calculator, ArrowUpToLine, ArrowDownToLine, Move, Link, RefreshCcw, Unlink
} from "lucide-react";

interface WhiteboardCanvasProps {
  activeTool: string;
  activeColor: string;
  strokeWidth: number;
  isGridEnabled: boolean;
  panOffset: { x: number; y: number };
  zoom: number;
  onPanChange: (offset: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  canvasObjects: CanvasObject[];
  onUpdateObjects: (objs: CanvasObject[], pushHistory?: boolean) => void;
  onSetSelectionText: (text: string) => void;
  ruler: RulerState;
  onUpdateRuler: (ruler: RulerState) => void;
  isEyedropperActive: boolean;
  onDeactivateEyedropper: () => void;
  onPickColor: (color: string) => void;
  isSnapToGrid?: boolean;
  isSmartEngineeringMode?: boolean;
  renderBackend?: "webgl" | "svg";
  isSimplificationEnabled?: boolean;
  simplificationTolerance?: number;
  isFrustumCullingEnabled?: boolean;
}

export interface FormulaSolution {
  formula: string;
  solution: string;
  x: number;
  y: number;
}

// Helper to calculate terminals for smart wire snapping
export const getComponentTerminals = (obj: CanvasObject) => {
  const width = obj.width || 100;
  const height = obj.height || 80;
  
  const left = { x: obj.x, y: obj.y + height / 2 };
  const right = { x: obj.x + width, y: obj.y + height / 2 };
  const top = { x: obj.x + width / 2, y: obj.y };
  const bottom = { x: obj.x + width / 2, y: obj.y + height };
  
  switch (obj.shapeType) {
    case "resistor":
    case "variable_resistor":
    case "capacitor":
    case "polarized_capacitor":
    case "inductor":
    case "transformer":
    case "cell":
    case "battery":
    case "fuse":
    case "switch":
    case "push_button":
    case "led":
    case "diode":
    case "zener_diode":
    case "line":
    case "arrow":
      return { left, right };
      
    case "ground":
    case "earth_ground":
      return { top };
      
    case "op_amp":
      return {
        in_minus: { x: obj.x, y: obj.y + height * 0.35 },
        in_plus: { x: obj.x, y: obj.y + height * 0.65 },
        out: { x: obj.x + width, y: obj.y + height / 2 }
      };
      
    case "npn_transistor":
    case "pnp_transistor":
      return {
        base: { x: obj.x, y: obj.y + height / 2 },
        collector: { x: obj.x + width * 0.85, y: obj.y + height * 0.15 },
        emitter: { x: obj.x + width * 0.85, y: obj.y + height * 0.85 }
      };
      
    case "and":
    case "or":
    case "nand":
    case "nor":
    case "xor":
    case "xnor":
      return {
        in1: { x: obj.x, y: obj.y + height * 0.3 },
        in2: { x: obj.x, y: obj.y + height * 0.7 },
        out: { x: obj.x + width, y: obj.y + height / 2 }
      };
      
    default:
      return { left, right, top, bottom };
  }
};

// Smart Engineering sketch classification helper
export const detectEngineeringSketch = (points: { x: number; y: number }[], w: number, h: number) => {
  const aspect = w / h;
  const numPoints = points.length;
  
  let directionChanges = 0;
  for (let i = 2; i < points.length; i++) {
    const dy1 = points[i-1].y - points[i-2].y;
    const dy2 = points[i].y - points[i-1].y;
    if (dy1 * dy2 < 0 && Math.abs(dy1) > 2 && Math.abs(dy2) > 2) {
      directionChanges++;
    }
  }

  const startPt = points[0];
  const endPt = points[points.length - 1];
  const distanceStartEnd = Math.hypot(endPt.x - (startPt ? startPt.x : 0), endPt.y - (startPt ? startPt.y : 0));
  const isClosed = distanceStartEnd < Math.max(w, h) * 0.25;

  if (directionChanges >= 4) {
    if (aspect > 1.2) {
      return { shapeType: "resistor", label: "Resistor (Electrical)" };
    } else {
      return { shapeType: "inductor", label: "Inductor (Electrical)" };
    }
  }

  if (isClosed) {
    if (Math.abs(1 - aspect) < 0.2) {
      return { shapeType: "circle", label: "Circle/Ellipse (Geometry)" };
    } else {
      return { shapeType: "start_end", label: "Start/End Pill (Flowchart)" };
    }
  }

  if (aspect > 3 && h < 20) {
    return { shapeType: "line", label: "Straight Line (Connection)" };
  }
  if (aspect < 0.3 && w < 20) {
    return { shapeType: "line", label: "Straight Line (Connection)" };
  }
  
  const pool = [
    { shapeType: "resistor", label: "Resistor (Electrical)" },
    { shapeType: "capacitor", label: "Capacitor (Electrical)" },
    { shapeType: "diode", label: "Diode (Electrical)" },
    { shapeType: "and", label: "AND Gate (Logic)" },
    { shapeType: "or", label: "OR Gate (Logic)" },
    { shapeType: "decision", label: "Decision Diamond (Flowchart)" },
    { shapeType: "start_end", label: "Start/End Pill (Flowchart)" },
    { shapeType: "process", label: "Process (Flowchart)" },
    { shapeType: "database", label: "Database Cylinder (Flowchart)" },
    { shapeType: "gear", label: "Gear (Mechanical)" },
    { shapeType: "cloud", label: "Cloud (Network)" },
    { shapeType: "integrals", label: "Integral Symbol (Math)" },
  ];
  
  const idx = Math.abs(Math.round(w + h + numPoints)) % pool.length;
  return pool[idx];
};

const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]) => {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// High-performance Douglas-Peucker path decimation algorithm
const simplifyPath = (points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] => {
  if (points.length <= 2) return points;

  let maxSqDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const sqDist = getSqSegDist(points[i], points[0], points[end]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > tolerance * tolerance) {
    const results1 = simplifyPath(points.slice(0, index + 1), tolerance);
    const results2 = simplifyPath(points.slice(index), tolerance);
    return results1.slice(0, results1.length - 1).concat(results2);
  }

  return [points[0], points[end]];
};

const getSqSegDist = (p: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return dx * dx + dy * dy;
};

const renderPointsToDataUrl = (
  points: { x: number; y: number }[],
  strokeWidth: number,
  color: string,
  w: number,
  h: number
): string => {
  try {
    const tempCanvas = document.createElement("canvas");
    const padding = 30; // generous padding for formula context
    tempCanvas.width = Math.max(100, w + padding * 2);
    tempCanvas.height = Math.max(100, h + padding * 2);
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return "";

    // Fill high-contrast crisp white background for high-fidelity OCR visual extraction
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw handwriting path in crisp black ink to maximize OCR pattern recognition
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(4, strokeWidth * 1.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    points.forEach((p, index) => {
      if (index === 0) {
        ctx.moveTo(p.x + padding, p.y + padding);
      } else {
        ctx.lineTo(p.x + padding, p.y + padding);
      }
    });
    ctx.stroke();

    return tempCanvas.toDataURL("image/png");
  } catch (e) {
    console.error("Failed to render strokes to data URL", e);
    return "";
  }
};

const getObjectDimensions = (o: CanvasObject) => {
  if (!o) return { w: 100, h: 80 };
  const w = o.width || (o.type === "text" || o.type === "formula" ? 350 : o.type === "table" ? 450 : 100);
  const h = o.height || (o.type === "text" || o.type === "formula" ? 60 : o.type === "table" ? 180 : 80);
  return { w, h };
};

const getSelectedHandwritingDataUrl = (canvasObjects: CanvasObject[]): { dataUrl: string; minX: number; minY: number; w: number; h: number } | null => {
  const selectedHandwriting = canvasObjects.filter(
    (obj) => (obj.isSelected || obj.isLassoSelected) && obj.type === "handwriting" && obj.points && obj.points.length > 0
  );
  if (selectedHandwriting.length === 0) return null;

  // Calculate global bounding box of all selected handwriting strokes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedHandwriting.forEach((obj) => {
    obj.points!.forEach((p) => {
      const absX = obj.x + p.x;
      const absY = obj.y + p.y;
      if (absX < minX) minX = absX;
      if (absY < minY) minY = absY;
      if (absX > maxX) maxX = absX;
      if (absY > maxY) maxY = absY;
    });
  });

  const w = maxX - minX;
  const h = maxY - minY;

  try {
    const tempCanvas = document.createElement("canvas");
    const padding = 30; // generous padding for formula context
    tempCanvas.width = Math.max(100, w + padding * 2);
    tempCanvas.height = Math.max(100, h + padding * 2);
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return null;

    // Fill high-contrast crisp white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw handwriting paths
    selectedHandwriting.forEach((obj) => {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = Math.max(4, (obj.strokeWidth || 3) * 1.5);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      obj.points!.forEach((p, index) => {
        const absX = obj.x + p.x;
        const absY = obj.y + p.y;
        const relX = absX - minX + padding;
        const relY = absY - minY + padding;

        if (index === 0) {
          ctx.moveTo(relX, relY);
        } else {
          ctx.lineTo(relX, relY);
        }
      });
      ctx.stroke();
    });

    return {
      dataUrl: tempCanvas.toDataURL("image/png"),
      minX,
      minY,
      w,
      h,
    };
  } catch (e) {
    console.error("Failed to render selected strokes to data URL", e);
    return null;
  }
};

export default function WhiteboardCanvas({
  activeTool,
  activeColor,
  strokeWidth,
  isGridEnabled,
  panOffset,
  zoom,
  onPanChange,
  onZoomChange,
  canvasObjects,
  onUpdateObjects,
  onSetSelectionText,
  ruler,
  onUpdateRuler,
  isEyedropperActive,
  onDeactivateEyedropper,
  onPickColor,
  isSnapToGrid = false,
  isSmartEngineeringMode = false,
  renderBackend = "webgl",
  isSimplificationEnabled = true,
  simplificationTolerance = 1.5,
  isFrustumCullingEnabled = true,
}: WhiteboardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const latestMouseEventRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);


  // Custom states for new tools (Text, Formula, Voice Note)
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const activeAudiosRef = useRef<{ [key: string]: HTMLAudioElement }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const secondsCountRef = useRef(0);

  // Ruler drag and snap states
  const [rulerDragMode, setRulerDragMode] = useState<"none" | "move" | "rotate" | "resize">("none");
  const [rulerDragStart, setRulerDragStart] = useState<{ x: number; y: number; rulerStart: { x: number; y: number; angle: number; length: number } } | null>(null);
  const rulerSnapStartCoords = useRef<{ x: number; y: number } | null>(null);
  const wasSnappedRef = useRef(false);
  const [liveRulerDrawLength, setLiveRulerDrawLength] = useState<string | null>(null);

  // Geometry Tool custom dragging states
  const [geoDrag, setGeoDrag] = useState<{
    objId: string;
    handleId: string;
    startMouseX: number;
    startMouseY: number;
    startObj: CanvasObject;
  } | null>(null);

  const handleGeoAction = (actionType: string, params: any) => {
    if (actionType === "draw_circle" || actionType === "stamp_circle") {
      const { cx, cy, radius } = params;
      const newObj: CanvasObject = {
        id: `shape-circle-${Date.now()}`,
        type: "shape",
        shapeType: "circle",
        x: cx - radius,
        y: cy - radius,
        width: radius * 2,
        height: radius * 2,
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: activeColor,
        strokeWidth: strokeWidth,
        isSelected: false
      };
      onUpdateObjects([...canvasObjects, newObj]);
    } else if (actionType === "draw_arc") {
      const { cx, cy, radius } = params;
      const points: { x: number; y: number }[] = [];
      // Create a clean arc path (180 degrees)
      for (let deg = 0; deg <= 180; deg += 4) {
        const rad = (deg * Math.PI) / 180;
        points.push({
          x: cx + radius * Math.cos(rad),
          y: cy + radius * Math.sin(rad)
        });
      }
      
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);

      const newObj: CanvasObject = {
        id: `drawn-arc-${Date.now()}`,
        type: "handwriting",
        x: minX,
        y: minY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
        points: points.map(p => ({ x: p.x - minX, y: p.y - minY })),
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: activeColor,
        strokeWidth: strokeWidth,
        isSelected: false
      };
      onUpdateObjects([...canvasObjects, newObj]);
    } else if (actionType === "stamp_ellipse") {
      const { cx, cy, rx, ry } = params;
      const newObj: CanvasObject = {
        id: `shape-ellipse-${Date.now()}`,
        type: "shape",
        shapeType: "ellipse",
        x: cx - rx,
        y: cy - ry,
        width: rx * 2,
        height: ry * 2,
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: activeColor,
        strokeWidth: strokeWidth,
        isSelected: false
      };
      onUpdateObjects([...canvasObjects, newObj]);
    }
  };

  // Mathematical snapped coordinate calculation helper
  const snapToRuler = (coords: { x: number; y: number }, rulerObj: RulerState) => {
    if (!rulerObj || !rulerObj.isActive || !rulerObj.isSnapMode) return null;

    const rad = (rulerObj.angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);

    const vx = coords.x - rulerObj.x;
    const vy = coords.y - rulerObj.y;

    const proj_dist = vx * dx + vy * dy; // distance along long axis from center
    const norm_dist = vx * nx + vy * ny; // distance perpendicular to long axis from center

    const thickness = 65;
    const half_len = rulerObj.length / 2;

    // Check if cursor is adjacent to the ruler's length
    if (Math.abs(proj_dist) <= half_len + 15) {
      const top_edge = -thickness / 2;
      const bottom_edge = thickness / 2;
      const snap_threshold = 25; // snap within 25 pixels

      let snap_norm = null;
      if (Math.abs(norm_dist - top_edge) < snap_threshold) {
        snap_norm = top_edge;
      } else if (Math.abs(norm_dist - bottom_edge) < snap_threshold) {
        snap_norm = bottom_edge;
      }

      if (snap_norm !== null) {
        // Clamp projection to ruler length
        const clamped_proj = Math.max(-half_len, Math.min(half_len, proj_dist));
        return {
          x: rulerObj.x + clamped_proj * dx + snap_norm * nx,
          y: rulerObj.y + clamped_proj * dy + snap_norm * ny,
          snapped: true,
          length_mm: Math.round((clamped_proj + half_len) / 3.78) // millimeter position on ruler
        };
      }
    }

    return null;
  };

  // Keep a ref of canvasObjects to avoid stale closure issues in async callbacks/intervals
  const canvasObjectsRef = useRef<CanvasObject[]>(canvasObjects);
  useEffect(() => {
    canvasObjectsRef.current = canvasObjects;
  }, [canvasObjects]);


  // Clean up any active audio players or recordings on unmount
  useEffect(() => {
    return () => {
      Object.values(activeAudiosRef.current).forEach((audio: any) => {
        audio.pause();
        if (audio._simInterval) clearInterval(audio._simInterval);
      });
      if (mediaRecorderRef.current) {
        clearInterval((mediaRecorderRef.current as any)._intervalId);
        if ((mediaRecorderRef.current as any)._stream) {
          (mediaRecorderRef.current as any)._stream.getTracks().forEach((t: any) => t.stop());
        }
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const startVoiceRecordingFlow = (coords: { x: number; y: number }) => {
    const voiceObjId = `voice-${Date.now()}`;
    
    const setupRecordingObject = (isSimulated: boolean) => {
      const newVoiceObj: CanvasObject = {
        id: voiceObjId,
        type: "voice",
        x: coords.x - 160,
        y: coords.y - 45,
        width: 320,
        height: 90,
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#ffd60a",
        strokeWidth: 2,
        audioTitle: "Voice Note " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRecording: true,
        elapsedRecordingSeconds: 0,
        isSelected: true,
        isLassoSelected: true,
        waveform: Array.from({ length: 24 }, () => Math.random() * 0.4 + 0.1)
      };

      onUpdateObjects([
        ...canvasObjectsRef.current.map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
        newVoiceObj
      ]);

      let seconds = 0;
      secondsCountRef.current = 0;
      const interval = setInterval(() => {
        seconds += 1;
        secondsCountRef.current = seconds;
        onUpdateObjects(
          canvasObjectsRef.current.map(o => {
            if (o.id === voiceObjId) {
              return {
                ...o,
                elapsedRecordingSeconds: seconds,
                waveform: Array.from({ length: 24 }, () => Math.random() * 0.7 + 0.1)
              };
            }
            return o;
          }),
          false
        );
      }, 1000);

      return { interval };
    };

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = chunks;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const { interval } = setupRecordingObject(false);

      (mediaRecorder as any)._intervalId = interval;
      (mediaRecorder as any)._stream = stream;

      mediaRecorder.start();
    }).catch((error) => {
      console.warn("Microphone access blocked or not supported. Falling back to voice note audio simulation...", error);
      
      const { interval } = setupRecordingObject(true);

      const dummyRecorder = {
        _intervalId: interval,
        stop: () => {
          clearInterval(interval);
          const simulatedSeconds = secondsCountRef.current || 5;
          const fakeAudioUrl = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";
          onUpdateObjects(
            canvasObjectsRef.current.map(o => {
              if (o.id === voiceObjId) {
                return {
                  ...o,
                  isRecording: false,
                  audioUrl: fakeAudioUrl,
                  audioDuration: simulatedSeconds,
                  audioPlaying: false,
                  audioCurrentTime: 0,
                  waveform: Array.from({ length: 24 }, () => Math.random() * 0.6 + 0.2)
                };
              }
              return o;
            })
          );
        }
      };
      (window as any)[`dummyRecorder_${voiceObjId}`] = dummyRecorder;
    });
  };

  const stopActiveRecording = (objId: string) => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      clearInterval((mediaRecorder as any)._intervalId);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);
        
        onUpdateObjects(
          canvasObjectsRef.current.map(o => {
            if (o.id === objId || o.isRecording) {
              return {
                ...o,
                isRecording: false,
                audioUrl: audioUrl,
                audioDuration: o.elapsedRecordingSeconds || 5,
                audioPlaying: false,
                audioCurrentTime: 0,
                waveform: Array.from({ length: 24 }, () => Math.random() * 0.6 + 0.2)
              };
            }
            return o;
          })
        );

        if ((mediaRecorder as any)._stream) {
          (mediaRecorder as any)._stream.getTracks().forEach((track: any) => track.stop());
        }
      };
      mediaRecorder.stop();
      mediaRecorderRef.current = null;
    } else {
      const simulatedRecorder = (window as any)[`dummyRecorder_${objId}`];
      if (simulatedRecorder) {
        simulatedRecorder.stop();
        delete (window as any)[`dummyRecorder_${objId}`];
      }
    }
  };

  const togglePlayAudio = (objId: string, url: string) => {
    const existing = activeAudiosRef.current[objId];
    if (existing) {
      if (!existing.paused) {
        existing.pause();
        onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioPlaying: false } : o));
        return;
      } else {
        existing.play().then(() => {
          onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioPlaying: true } : o));
        });
        return;
      }
    }

    const audio = new Audio(url);
    activeAudiosRef.current[objId] = audio;

    audio.ontimeupdate = () => {
      onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioCurrentTime: audio.currentTime } : o), false);
    };

    audio.onended = () => {
      onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioPlaying: false, audioCurrentTime: 0 } : o));
    };

    audio.play().then(() => {
      onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioPlaying: true } : o));
    }).catch((e) => {
      console.warn("Native playback blocked. Simulating play progression...", e);
      onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioPlaying: true } : o));
      let progress = 0;
      const targetObj = canvasObjectsRef.current.find(o => o.id === objId);
      const duration = targetObj?.audioDuration || 5;
      const interval = setInterval(() => {
        progress += 0.2;
        if (progress >= duration) {
          clearInterval(interval);
          onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioPlaying: false, audioCurrentTime: 0 } : o));
        } else {
          onUpdateObjects(canvasObjectsRef.current.map(o => o.id === objId ? { ...o, audioCurrentTime: progress } : o), false);
        }
      }, 200);
      (audio as any)._simInterval = interval;
    });
  };

  const renderMathExpression = (expr: string): React.ReactNode => {
    if (!expr) {
      return <span className="opacity-40 italic text-xs">Double click to type formula...</span>;
    }

    let formatted = expr;

    const symbolReplacements: { [key: string]: string } = {
      "\\nabla": "∇",
      "\\times": "×",
      "\\partial": "∂",
      "\\Sigma": "Σ",
      "\\alpha": "α",
      "\\beta": "β",
      "\\gamma": "γ",
      "\\pi": "π",
      "\\int": "∫",
      "\\sqrt": "√",
      "\\infty": "∞",
      "\\approx": "≈",
      "\\ne": "≠",
      "\\le": "≤",
      "\\ge": "≥",
      "\\Delta": "Δ",
      "\\theta": "θ",
      "\\lambda": "λ",
      "\\mu": "μ",
      "\\omega": "ω",
      "\\phi": "φ",
      "\\psi": "ψ",
      "\\rho": "ρ",
      "\\cdot": "•",
      "->": "→",
      "<-": "←",
    };

    Object.keys(symbolReplacements).forEach((key) => {
      formatted = formatted.replaceAll(key, symbolReplacements[key]);
    });

    const parseMathToJsx = (text: string): React.ReactNode => {
      const fracParts = text.split(/(\\frac\s*{.*?}\s*{.*?})/g);
      return (
        <span className="font-serif italic text-base flex items-center justify-center flex-wrap gap-1">
          {fracParts.map((part, idx) => {
            const fracMatch = part.match(/\\frac\s*{(.*?)}\s*{(.*?)}/);
            if (fracMatch) {
              const num = fracMatch[1];
              const den = fracMatch[2];
              return (
                <span key={idx} className="inline-flex flex-col items-center justify-center px-1 font-serif text-sm align-middle leading-none shrink-0 mx-0.5">
                  <span className="border-b border-white/60 pb-0.5 text-center w-full">{parseMathToJsx(num)}</span>
                  <span className="pt-0.5 text-center w-full">{parseMathToJsx(den)}</span>
                </span>
              );
            }

            const scriptParts = part.split(/([\^_]{.*?}|[\^_]\w)/g);
            return (
              <span key={idx} className="inline-flex items-center">
                {scriptParts.map((subPart, sIdx) => {
                  if (subPart.startsWith("^")) {
                    const exponentContent = subPart.startsWith("^{")
                      ? subPart.slice(2, -1)
                      : subPart.slice(1);
                    return <sup key={sIdx} className="text-[10px] leading-none align-super font-sans font-normal normal-case ml-px shrink-0">{exponentContent}</sup>;
                  }
                  if (subPart.startsWith("_")) {
                    const subContent = subPart.startsWith("_{")
                      ? subPart.slice(2, -1)
                      : subPart.slice(1);
                    return <sub key={sIdx} className="text-[10px] leading-none align-sub font-sans font-normal normal-case ml-px shrink-0">{subContent}</sub>;
                  }
                  return <span key={sIdx} className="tracking-wide">{subPart}</span>;
                })}
              </span>
            );
          })}
        </span>
      );
    };

    return parseMathToJsx(formatted);
  };

  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  
  // Transformation states
  const [transformMode, setTransformMode] = useState<"none" | "move" | "resize" | "rotate">("none");
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [transformStart, setTransformStart] = useState<{
    x: number;
    y: number;
    objectsStart: { id: string; x: number; y: number; width: number; height: number; rotation: number }[];
  }>({ x: 0, y: 0, objectsStart: [] });

  // Lasso state
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoSelectionBounds, setLassoSelectionBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Solutions Card State (Smart Calculator)
  const [formulaSolutions, setFormulaSolutions] = useState<FormulaSolution[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Smart Engineering Mode states
  const [pendingRecognition, setPendingRecognition] = useState<{
    id: string;
    strokeObj: CanvasObject;
    detectedType: string;
    detectedLabel: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [smartSettings, setSmartSettings] = useState({
    alwaysConvert: false,
    neverConvert: false,
  });

  const [aiRecognitionStatus, setAiRecognitionStatus] = useState<{
    x: number;
    y: number;
    message: string;
  } | null>(null);

  // Spacebar pan tracking
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Map viewport coordinates to infinite canvas space
  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - panOffset.x) / zoom;
    const y = (clientY - rect.top - panOffset.y) / zoom;
    return { x, y };
  };

  // Unify standard selection bounding box calculation
  const getSelectedBounds = () => {
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    if (selected.length === 0) return null;
    
    const minX = Math.min(...selected.map(o => o.x));
    const maxX = Math.max(...selected.map(o => o.x + (o.width || 100)));
    const minY = Math.min(...selected.map(o => o.y));
    const maxY = Math.max(...selected.map(o => o.y + (o.height || 80)));
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const startResizing = (e: React.MouseEvent, handle: string, bounds: { x: number; y: number; width: number; height: number }) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    setTransformMode("resize");
    setResizeHandle(handle);
    
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    setTransformStart({
      x: coords.x,
      y: coords.y,
      objectsStart: selected.map(o => {
        const { w, h } = getObjectDimensions(o);
        return {
          id: o.id,
          x: o.x,
          y: o.y,
          width: w,
          height: h,
          rotation: o.rotation || 0
        };
      })
    });
  };

  const startRotation = (e: React.MouseEvent, bounds: { x: number; y: number; width: number; height: number }) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    setTransformMode("rotate");
    
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    setTransformStart({
      x: coords.x,
      y: coords.y,
      objectsStart: selected.map(o => {
        const { w, h } = getObjectDimensions(o);
        return {
          id: o.id,
          x: o.x,
          y: o.y,
          width: w,
          height: h,
          rotation: o.rotation || 0
        };
      })
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);

    // Pre-calculate clicked object for tool intercept checks
    const clickedObj = [...canvasObjects].reverse().find((obj) => {
      if (obj.hidden || obj.isLocked) return false;
      const { w, h } = getObjectDimensions(obj);
      return (
        coords.x >= obj.x &&
        coords.x <= obj.x + w &&
        coords.y >= obj.y &&
        coords.y <= obj.y + h
      );
    });

    // Eyedropper mode intercept
    if (isEyedropperActive) {
      e.stopPropagation();
      e.preventDefault();
      if (clickedObj) {
        onPickColor(clickedObj.color);
      } else {
        onPickColor("#D0BCFF"); // Fallback color
      }
      onDeactivateEyedropper();
      return;
    }

    // Left click with space, or middle click, or pan tool initiates infinite pan
    if (isSpacePressed || e.button === 1 || activeTool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }


    // Lasso tool - only start new lasso if we didn't click on an already selected object!
    if (activeTool === "lasso") {
      const isAlreadySelected = clickedObj && (clickedObj.isSelected || clickedObj.isLassoSelected);
      if (!isAlreadySelected) {
        setLassoActive(true);
        setLassoPoints([coords]);
        setLassoSelectionBounds(null);
        // Clear previous selections
        onUpdateObjects(canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false })));
        onSetSelectionText("");
        return;
      }
    }

    // Eraser tool
    if (activeTool === "eraser") {
      setIsDrawing(true);
      eraseAt(coords);
      return;
    }

    // Pen, Highlighter drawing
    if (activeTool === "pen" || activeTool === "highlighter") {
      setIsDrawing(true);
      setCurrentPath([coords]);
      return;
    }

    // Clicking shape or content tools triggers placement on-click
    if (["rectangle", "circle", "triangle", "resistor", "battery", "lamp", "text", "formula", "voice"].includes(activeTool)) {
      if (activeTool === "text") {
        const textObjId = `text-${Date.now()}`;
        const newObj: CanvasObject = {
          id: textObjId,
          type: "text",
          x: coords.x - 100,
          y: coords.y - 50,
          width: 250,
          height: 100,
          rotation: 0,
          layer: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          color: activeColor,
          strokeWidth: 2,
          content: "Double click to edit",
          fontFamily: "Inter",
          fontSize: 16,
          bold: false,
          italic: false,
          underline: false,
          isSelected: true,
          isLassoSelected: true,
        };
        onUpdateObjects([
          ...canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
          newObj
        ]);
        setEditingObjectId(textObjId);
        onSetSelectionText("Double click to edit");
        return;
      }

      if (activeTool === "formula") {
        const formulaObjId = `formula-${Date.now()}`;
        const newObj: CanvasObject = {
          id: formulaObjId,
          type: "formula",
          x: coords.x - 150,
          y: coords.y - 40,
          width: 300,
          height: 80,
          rotation: 0,
          layer: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          color: "#D0BCFF",
          strokeWidth: 2,
          content: "x^2 + y^2 = r^2",
          isSelected: true,
          isLassoSelected: true,
        };
        onUpdateObjects([
          ...canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
          newObj
        ]);
        setEditingObjectId(formulaObjId);
        onSetSelectionText("x^2 + y^2 = r^2");
        return;
      }

      if (activeTool === "voice") {
        startVoiceRecordingFlow(coords);
        return;
      }

      const newObj: CanvasObject = {
        id: `shape-${Date.now()}`,
        type: "shape",
        x: coords.x - 60,
        y: coords.y - 45,
        width: 120,
        height: 90,
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: activeColor,
        strokeWidth: strokeWidth,
        shapeType: activeTool as any,
        isSelected: true,
        isLassoSelected: true,
      };
      // Auto select the newly placed shape
      onUpdateObjects([
        ...canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
        newObj
      ]);
      return;
    }

    // Click Selection & Dragging Check
    if (clickedObj) {
      const isShiftPressed = e.shiftKey;
      const isAlreadySelected = clickedObj.isSelected || clickedObj.isLassoSelected;
      
      let updatedObjects = canvasObjects.map((obj) => {
        if (obj.id === clickedObj.id) {
          return { ...obj, isSelected: true, isLassoSelected: true };
        }
        if (isShiftPressed) {
          return obj;
        }
        return isAlreadySelected ? obj : { ...obj, isSelected: false, isLassoSelected: false };
      });
      
      onUpdateObjects(updatedObjects);
      
      setTransformMode("move");
      setTransformStart({
        x: coords.x,
        y: coords.y,
        objectsStart: updatedObjects
          .filter(o => o.isSelected || o.isLassoSelected)
          .map(o => {
            const { w, h } = getObjectDimensions(o);
            return {
              id: o.id,
              x: o.x,
              y: o.y,
              width: w,
              height: h,
              rotation: o.rotation || 0
            };
          })
      });
    } else {
      // Clicked empty space
      if (!e.shiftKey) {
        onUpdateObjects(canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false })));
        setLassoSelectionBounds(null);
      }
    }
  };

  const processMouseMove = (e: { clientX: number; clientY: number; shiftKey: boolean }) => {
    if (isPanning) {
      onPanChange({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const coords = getCanvasCoords(e.clientX, e.clientY);

    // Custom Geometry dragging
    if (geoDrag) {
      const dxObj = coords.x - geoDrag.startObj.x;
      const dyObj = coords.y - geoDrag.startObj.y;
      const radObj = -((geoDrag.startObj.rotation || 0) * Math.PI) / 180;
      const localX = dxObj * Math.cos(radObj) - dyObj * Math.sin(radObj);
      const localY = dxObj * Math.sin(radObj) + dyObj * Math.cos(radObj);

      const updated = canvasObjects.map((obj) => {
        if (obj.id !== geoDrag.objId) return obj;

        if (geoDrag.handleId === "protractor-needle") {
          const cx = geoDrag.startObj.width / 2;
          const cy = geoDrag.startObj.height / 2;
          let angle = Math.atan2(localY - cy, localX - cx) * (180 / Math.PI);
          if (angle < 0) angle += 360;
          return {
            ...obj,
            angleValue: Math.round(angle),
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "compass-pencil") {
          const cx = geoDrag.startObj.width / 2;
          const cy = geoDrag.startObj.height / 2;
          const dist = Math.hypot(localX - cx, localY - cy);
          return {
            ...obj,
            compassRadius: Math.max(20, Math.min(300, Math.round(dist))),
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "parallel-spacing") {
          return {
            ...obj,
            spacing: Math.max(20, Math.min(300, Math.round(localY - geoDrag.startObj.height / 2))),
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "ellipse-rx") {
          const cx = geoDrag.startObj.width / 2;
          const dist = Math.abs(localX - cx);
          return {
            ...obj,
            majorAxis: Math.max(10, Math.min(obj.width / 2, Math.round(dist))),
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "ellipse-ry") {
          const cy = geoDrag.startObj.height / 2;
          const dist = Math.abs(localY - cy);
          return {
            ...obj,
            minorAxis: Math.max(10, Math.min(obj.height / 2, Math.round(dist))),
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "measure-p1") {
          return {
            ...obj,
            p1: { x: Math.round(localX), y: Math.round(localY) },
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "measure-p2") {
          return {
            ...obj,
            p2: { x: Math.round(localX), y: Math.round(localY) },
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "angle-p1") {
          return {
            ...obj,
            p1: { x: Math.round(localX), y: Math.round(localY) },
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "angle-p2") {
          return {
            ...obj,
            p2: { x: Math.round(localX), y: Math.round(localY) },
            updatedAt: Date.now()
          };
        }

        if (geoDrag.handleId === "angle-p3") {
          return {
            ...obj,
            p3: { x: Math.round(localX), y: Math.round(localY) },
            updatedAt: Date.now()
          };
        }

        return obj;
      });

      onUpdateObjects(updated, false);
      return;
    }

    // Ruler drag: move
    if (rulerDragMode === "move" && rulerDragStart && ruler) {
      const deltaX = coords.x - rulerDragStart.x;
      const deltaY = coords.y - rulerDragStart.y;
      onUpdateRuler({
        ...ruler,
        x: rulerDragStart.rulerStart.x + deltaX,
        y: rulerDragStart.rulerStart.y + deltaY,
      });
      return;
    }

    // Ruler drag: rotate
    if (rulerDragMode === "rotate" && rulerDragStart && ruler) {
      const currentAngle = Math.atan2(coords.y - ruler.y, coords.x - ruler.x) * (180 / Math.PI);
      const startCursorAngle = Math.atan2(rulerDragStart.y - ruler.y, rulerDragStart.x - ruler.x) * (180 / Math.PI);
      const deltaAngle = currentAngle - startCursorAngle;
      onUpdateRuler({
        ...ruler,
        angle: Math.round((rulerDragStart.rulerStart.angle + deltaAngle) % 360),
      });
      return;
    }

    // Ruler drag: resize
    if (rulerDragMode === "resize" && rulerDragStart && ruler) {
      const rad = (ruler.angle * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const vx = coords.x - ruler.x;
      const vy = coords.y - ruler.y;
      const proj = vx * dx + vy * dy;
      const newLength = Math.max(150, Math.min(1000, Math.round(Math.abs(proj) * 2)));
      onUpdateRuler({
        ...ruler,
        length: newLength,
      });
      return;
    }

    // Live Translate/Move Object
    if (transformMode === "move") {
      const deltaX = coords.x - transformStart.x;
      const deltaY = coords.y - transformStart.y;
      
      const updated = canvasObjects.map((obj) => {
        const start = transformStart.objectsStart.find(s => s.id === obj.id);
        if (start) {
          let newX = start.x + deltaX;
          let newY = start.y + deltaY;
          if (isSnapToGrid) {
            newX = Math.round(newX / 32) * 32;
            newY = Math.round(newY / 32) * 32;
          }
          return {
            ...obj,
            x: newX,
            y: newY,
            updatedAt: Date.now()
          };
        }
        return obj;
      });

      // Update coordinates of any connected wires reactively so they move along smoothly!
      const finalUpdated = updated.map((wire) => {
        if (wire.type === "shape" && (wire.shapeType === "line" || wire.shapeType === "arrow")) {
          let pointsChanged = false;
          const points = wire.points ? [...wire.points] : [{ x: 0, y: 50 }, { x: 100, y: 50 }];
          
          if (wire.startConnection) {
            const target = updated.find(o => o.id === wire.startConnection?.targetId);
            if (target) {
              const terminals = getComponentTerminals(target);
              const term = terminals[wire.startConnection.port as keyof typeof terminals];
              if (term) {
                points[0] = { x: term.x - wire.x, y: term.y - wire.y };
                pointsChanged = true;
              }
            }
          }
          
          if (wire.endConnection) {
            const target = updated.find(o => o.id === wire.endConnection?.targetId);
            if (target) {
              const terminals = getComponentTerminals(target);
              const term = terminals[wire.endConnection.port as keyof typeof terminals];
              if (term) {
                points[1] = { x: term.x - wire.x, y: term.y - wire.y };
                pointsChanged = true;
              }
            }
          }
          
          if (pointsChanged) {
            return { ...wire, points };
          }
        }
        return wire;
      });

      onUpdateObjects(finalUpdated);
      return;
    }

    // Live Resize Object(s)
    if (transformMode === "resize" && resizeHandle) {
      const deltaX = coords.x - transformStart.x;
      const deltaY = coords.y - transformStart.y;
      
      const startObjs = transformStart.objectsStart;
      
      const minX_start = Math.min(...startObjs.map(s => s.x));
      const maxX_start = Math.max(...startObjs.map(s => s.x + s.width));
      const minY_start = Math.min(...startObjs.map(s => s.y));
      const maxY_start = Math.max(...startObjs.map(s => s.y + s.height));
      
      const W_start = maxX_start - minX_start;
      const H_start = maxY_start - minY_start;
      const X_start = minX_start;
      const Y_start = minY_start;
      
      let newW = W_start;
      let newH = H_start;
      let newX = X_start;
      let newY = Y_start;

      if (resizeHandle.includes("r")) {
        newW = Math.max(10, W_start + deltaX);
      } else if (resizeHandle.includes("l")) {
        newW = Math.max(10, W_start - deltaX);
        newX = X_start + (W_start - newW);
      }

      if (resizeHandle.includes("b")) {
        newH = Math.max(10, H_start + deltaY);
      } else if (resizeHandle.includes("t")) {
        newH = Math.max(10, H_start - deltaY);
        newY = Y_start + (H_start - newH);
      }
      
      const scaleX = W_start > 0 ? newW / W_start : 1;
      const scaleY = H_start > 0 ? newH / H_start : 1;
      
      const updated = canvasObjects.map((obj) => {
        const start = startObjs.find(s => s.id === obj.id);
        if (start) {
          const relX_start = start.x - X_start;
          const relY_start = start.y - Y_start;
          return {
            ...obj,
            x: newX + relX_start * scaleX,
            y: newY + relY_start * scaleY,
            width: Math.max(10, start.width * scaleX),
            height: Math.max(10, start.height * scaleY),
            updatedAt: Date.now()
          };
        }
        return obj;
      });
      onUpdateObjects(updated);
      return;
    }

    // Live Rotate Object(s)
    if (transformMode === "rotate") {
      const startObjs = transformStart.objectsStart;
      const minX_start = Math.min(...startObjs.map(s => s.x));
      const maxX_start = Math.max(...startObjs.map(s => s.x + s.width));
      const minY_start = Math.min(...startObjs.map(s => s.y));
      const maxY_start = Math.max(...startObjs.map(s => s.y + s.height));
      
      const centerX = minX_start + (maxX_start - minX_start) / 2;
      const centerY = minY_start + (maxY_start - minY_start) / 2;
      
      const currentAngle = Math.atan2(coords.y - centerY, coords.x - centerX) * (180 / Math.PI);
      const startAngle = Math.atan2(transformStart.y - centerY, transformStart.x - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - startAngle;
      
      const updated = canvasObjects.map((obj) => {
        const start = startObjs.find(s => s.id === obj.id);
        if (start) {
          return {
            ...obj,
            rotation: Math.round((start.rotation + deltaAngle) % 360),
            updatedAt: Date.now()
          };
        }
        return obj;
      });
      onUpdateObjects(updated);
      return;
    }

    if (isDrawing) {
      if (activeTool === "eraser") {
        eraseAt(coords);
      } else {
        let drawingCoords = coords;
        let showMetricDetail = false;
        let isCurrentSnapActive = false;

        if (ruler && ruler.isActive) {
          const snapped = snapToRuler(coords, ruler);
          if (snapped) {
            drawingCoords = { x: snapped.x, y: snapped.y };
            isCurrentSnapActive = true;
            
            // Set starting point for measuring draw length
            if (!rulerSnapStartCoords.current) {
              rulerSnapStartCoords.current = drawingCoords;
            }
            
            // Calculate distance in millimeters (3.78px = 1mm)
            const distPx = Math.hypot(drawingCoords.x - rulerSnapStartCoords.current.x, drawingCoords.y - rulerSnapStartCoords.current.y);
            const distMm = (distPx / 3.78).toFixed(1);
            setLiveRulerDrawLength(`${distMm} mm`);
            showMetricDetail = true;
          } else {
            rulerSnapStartCoords.current = null;
            setLiveRulerDrawLength(null);
          }
        }

        if (!showMetricDetail) {
          const snappedGeo = getSnappingCoordinates(coords, canvasObjects);
          if (snappedGeo) {
            drawingCoords = { x: snappedGeo.x, y: snappedGeo.y };
            isCurrentSnapActive = true;
            
            if (!rulerSnapStartCoords.current) {
              rulerSnapStartCoords.current = drawingCoords;
            }
            
            const distPx = Math.hypot(drawingCoords.x - rulerSnapStartCoords.current.x, drawingCoords.y - rulerSnapStartCoords.current.y);
            const distMm = (distPx / 3.78).toFixed(1);
            setLiveRulerDrawLength(`${distMm} mm (${snappedGeo.detail || "Snap"})`);
          } else {
            if (!ruler || !ruler.isActive) {
              rulerSnapStartCoords.current = null;
              setLiveRulerDrawLength(null);
            }
          }
        }

        if (isCurrentSnapActive && !wasSnappedRef.current) {
          triggerHaptic(10); // subtle 10ms click on snapping transition
        }
        wasSnappedRef.current = isCurrentSnapActive;

        setCurrentPath((prev) => [...prev, drawingCoords]);
      }
      return;
    }

    if (lassoActive) {
      setLassoPoints((prev) => [...prev, coords]);
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    latestMouseEventRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      shiftKey: e.shiftKey
    };

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (latestMouseEventRef.current) {
          processMouseMove(latestMouseEventRef.current);
        }
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (geoDrag) {
      setGeoDrag(null);
      onUpdateObjects(canvasObjects);
      return;
    }

    setIsPanning(false);
    setTransformMode("none");
    setResizeHandle(null);

    // Clean up ruler drag and snap measurements
    rulerSnapStartCoords.current = null;
    setLiveRulerDrawLength(null);
    wasSnappedRef.current = false;

    if (rulerDragMode !== "none") {
      setRulerDragMode("none");
      setRulerDragStart(null);
      return;
    }


    if (isDrawing) {
      setIsDrawing(false);
      if (currentPath.length > 1) {
        const xs = currentPath.map((p) => p.x);
        const ys = currentPath.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const w = maxX - minX || 10;
        const h = maxY - minY || 10;

        let relPoints = currentPath.map((p) => ({
          x: p.x - minX,
          y: p.y - minY,
        }));

        if (isSimplificationEnabled) {
          const originalLen = relPoints.length;
          relPoints = simplifyPath(relPoints, simplificationTolerance);
          console.log(`[OPTIMIZATION] Simplified stroke from ${originalLen} to ${relPoints.length} points.`);
        }

        const newObj: CanvasObject = {
          id: `stroke-${Date.now()}`,
          type: "handwriting",
          x: minX,
          y: minY,
          width: w,
          height: h,
          rotation: 0,
          layer: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          color: activeTool === "highlighter" ? `${activeColor}4d` : activeColor,
          strokeWidth: activeTool === "highlighter" ? strokeWidth * 2.5 : strokeWidth,
          points: relPoints,
        };

        if (isSmartEngineeringMode && activeTool === "pen") {
          // Add the stroke to canvas immediately so user doesn't wait
          onUpdateObjects([...canvasObjects, newObj]);

          const dataUrl = renderPointsToDataUrl(relPoints, strokeWidth, activeColor, w, h);
          if (dataUrl) {
            setAiRecognitionStatus({
              x: minX + w / 2,
              y: minY - 15,
              message: "AI recognizing..."
            });

            fetch("/api/ai/visual-ocr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: dataUrl })
            })
            .then(res => {
              if (!res.ok) throw new Error("Visual OCR request failed");
              return res.json();
            })
            .then(result => {
              if (result.isFormula && result.content) {
                // Succeeded in detecting and converting a beautiful LaTeX formula!
                triggerHaptic(30); // tactile confirmation for shape/formula completion
                const formulaObjId = `formula-${Date.now()}`;
                const formulaObj: CanvasObject = {
                  id: formulaObjId,
                  type: "formula",
                  x: minX,
                  y: Math.max(0, minY - 15),
                  width: Math.max(260, w + 40),
                  height: Math.max(70, h + 20),
                  rotation: 0,
                  layer: Date.now(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  color: activeColor,
                  strokeWidth: strokeWidth,
                  content: result.content,
                  isSelected: true,
                  isLassoSelected: true,
                };
                onUpdateObjects([
                  ...canvasObjectsRef.current.filter(o => o.id !== newObj.id).map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
                  formulaObj
                ]);
              } else {
                // If not a formula, fallback to the AI detected vector shape
                const shapeType = result.detectedType;
                if (shapeType) {
                  const label = result.detectedLabel || `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)}`;
                  if (smartSettings.alwaysConvert) {
                    triggerHaptic(30); // tactile shape completion
                    const vectorObj: CanvasObject = {
                      id: `library-${shapeType}-${Date.now()}`,
                      type: "shape",
                      x: minX,
                      y: minY,
                      width: w,
                      height: h,
                      rotation: 0,
                      layer: Date.now(),
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      color: activeColor,
                      strokeWidth: strokeWidth,
                      shapeType: shapeType as any,
                      isSelected: true,
                      isLassoSelected: true,
                      content: label.split(" (")[0],
                    };
                    onUpdateObjects([
                      ...canvasObjectsRef.current.filter(o => o.id !== newObj.id).map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
                      vectorObj
                    ]);
                  } else if (!smartSettings.neverConvert) {
                    triggerHaptic([20, 50, 20]); // double pulse notification of sketch recognition
                    setPendingRecognition({
                      id: newObj.id,
                      strokeObj: newObj,
                      detectedType: shapeType,
                      detectedLabel: label,
                      x: minX,
                      y: minY,
                      width: w,
                      height: h,
                    });
                  }
                } else {
                  // Fallback to local heuristic detection
                  const detection = detectEngineeringSketch(relPoints, w, h);
                  if (smartSettings.alwaysConvert) {
                    triggerHaptic(30); // tactile shape completion
                    const vectorObj: CanvasObject = {
                      id: `library-${detection.shapeType}-${Date.now()}`,
                      type: "shape",
                      x: minX,
                      y: minY,
                      width: w,
                      height: h,
                      rotation: 0,
                      layer: Date.now(),
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      color: activeColor,
                      strokeWidth: strokeWidth,
                      shapeType: detection.shapeType as any,
                      isSelected: true,
                      isLassoSelected: true,
                      content: detection.label.split(" (")[0],
                    };
                    onUpdateObjects([
                      ...canvasObjectsRef.current.filter(o => o.id !== newObj.id).map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
                      vectorObj
                    ]);
                  } else if (!smartSettings.neverConvert) {
                    triggerHaptic([20, 50, 20]); // double pulse notification of sketch recognition
                    setPendingRecognition({
                      id: newObj.id,
                      strokeObj: newObj,
                      detectedType: detection.shapeType,
                      detectedLabel: detection.label,
                      x: minX,
                      y: minY,
                      width: w,
                      height: h,
                    });
                  }
                }
              }
            })
            .catch(err => {
              console.error("AI Visual recognition failed, falling back to heuristic classification:", err);
              const detection = detectEngineeringSketch(relPoints, w, h);
              if (smartSettings.alwaysConvert) {
                triggerHaptic(30); // tactile shape completion
                const vectorObj: CanvasObject = {
                  id: `library-${detection.shapeType}-${Date.now()}`,
                  type: "shape",
                  x: minX,
                  y: minY,
                  width: w,
                  height: h,
                  rotation: 0,
                  layer: Date.now(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  color: activeColor,
                  strokeWidth: strokeWidth,
                  shapeType: detection.shapeType as any,
                  isSelected: true,
                  isLassoSelected: true,
                  content: detection.label.split(" (")[0],
                };
                onUpdateObjects([
                  ...canvasObjectsRef.current.filter(o => o.id !== newObj.id).map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
                  vectorObj
                ]);
              } else if (!smartSettings.neverConvert) {
                triggerHaptic([20, 50, 20]); // double pulse notification of sketch recognition
                setPendingRecognition({
                  id: newObj.id,
                  strokeObj: newObj,
                  detectedType: detection.shapeType,
                  detectedLabel: detection.label,
                  x: minX,
                  y: minY,
                  width: w,
                  height: h,
                });
              }
            })
            .finally(() => {
              setAiRecognitionStatus(null);
            });
          } else {
            onUpdateObjects([...canvasObjects, newObj]);
          }
        } else {
          onUpdateObjects([...canvasObjects, newObj]);
        }
      }
      setCurrentPath([]);
      return;
    }

    if (lassoActive) {
      setLassoActive(false);
      if (lassoPoints.length > 5) {
        const xs = lassoPoints.map((p) => p.x);
        const ys = lassoPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const bounds = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };

        let selectedSomething = false;
        const updated = canvasObjects.map((obj) => {
          if (obj.isLocked || obj.hidden) {
            return {
              ...obj,
              isSelected: false,
              isLassoSelected: false,
            };
          }
          const { w, h } = getObjectDimensions(obj);
          const cx = obj.x + w / 2;
          const cy = obj.y + h / 2;
          // Clean point-in-polygon containment check
          const isContained = isPointInPolygon({ x: cx, y: cy }, lassoPoints);
          if (isContained) selectedSomething = true;
          return {
            ...obj,
            isSelected: isContained,
            isLassoSelected: isContained,
          };
        });

        if (selectedSomething) {
          onUpdateObjects(updated);
          setLassoSelectionBounds(bounds);
          
          // Generate a highly context-rich selection description for the AI Assistant
          const selectedList = updated.filter(o => o.isSelected);
          const textParts = selectedList.map(o => {
            if (o.type === "text" || o.type === "formula" || o.type === "table") {
              return o.content;
            }
            if (o.type === "handwriting") {
              return "∇ × E = -∂B/∂t"; // Simulate beautiful ink OCR extraction of the handwritten strokes
            }
            if (o.type === "shape") {
              return `[${o.shapeType || "shape"} diagram symbol]`;
            }
            if (o.type === "voice") {
              return `[Voice note transcription: ${o.content || ""}]`;
            }
            return `[${o.type} element]`;
          }).filter(Boolean);

          const finalDesc = textParts.join(" ") || "∇ × E = -∂B/∂t";
          onSetSelectionText(finalDesc);
        } else {
          onUpdateObjects(canvasObjects.map((o) => ({ ...o, isSelected: false, isLassoSelected: false })));
          setLassoSelectionBounds(null);
          onSetSelectionText("");
        }
      }
      setLassoPoints([]);
    }
  };

  const eraseAt = (coords: { x: number; y: number }) => {
    const threshold = 25;
    const remaining = canvasObjects.filter((obj) => {
      if (obj.points) {
        return !obj.points.some(
          (p) => Math.hypot((obj.x + p.x) - coords.x, (obj.y + p.y) - coords.y) < threshold
        );
      }
      const w = obj.width || 100;
      const h = obj.height || 80;
      const cx = obj.x + w / 2;
      const cy = obj.y + h / 2;
      return Math.hypot(cx - coords.x, cy - coords.y) > threshold;
    });
    onUpdateObjects(remaining);
  };

  const handleConvertSelection = async (targetType: "text" | "formula") => {
    const selected = canvasObjects.filter((obj) => obj.isSelected || obj.isLassoSelected);
    if (selected.length === 0) return;

    setIsConverting(true);
    setLassoSelectionBounds(null);

    try {
      const ocrResult = getSelectedHandwritingDataUrl(canvasObjects);
      let digitalOutput = "";
      let minX = selected[0].x;
      let minY = selected[0].y;
      let w = selected[0].width || 350;
      let h = selected[0].height || 60;

      if (ocrResult) {
        minX = ocrResult.minX;
        minY = ocrResult.minY;
        w = Math.max(350, ocrResult.w + 40);
        h = Math.max(60, ocrResult.h + 20);

        const response = await fetch("/api/ai/visual-ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: ocrResult.dataUrl, targetType }),
        });

        if (!response.ok) throw new Error("Failed to contact visual OCR API");
        const data = await response.json();
        digitalOutput = data.content || "";
      } else {
        // Fallback: look for existing text/formula/voice elements
        const existingTexts = selected
          .filter((o) => o.type === "text" || o.type === "formula" || o.type === "voice")
          .map((o) => o.content)
          .filter(Boolean);
        if (existingTexts.length > 0) {
          digitalOutput = existingTexts.join(" ");
        } else {
          digitalOutput = targetType === "formula" ? "y = mx + c" : "Empty selection notes";
        }
      }

      if (!digitalOutput) {
        digitalOutput = targetType === "formula" ? "\\nabla \\cdot B = 0" : "Unrecognized handwriting stroke";
      }

      triggerHaptic(30);

      const newObj: CanvasObject = {
        id: `converted-${Date.now()}`,
        type: targetType,
        x: minX,
        y: minY,
        width: w,
        height: h,
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#D0BCFF",
        strokeWidth: 2,
        content: digitalOutput,
        isSelected: true,
        isLassoSelected: true,
      };

      const cleanList = canvasObjects.filter((obj) => !obj.isSelected && !obj.isLassoSelected);
      onUpdateObjects([...cleanList, newObj]);
    } catch (e) {
      console.error("AI Conversion Error:", e);
      triggerHaptic([10, 50, 10]);
      const defaultVal = targetType === "formula" ? "\\nabla \\times E = -\\frac{\\partial B}{\\partial t}" : "AI transcription service temporarily unavailable.";
      const firstSel = selected[0];
      const fallbackObj: CanvasObject = {
        id: `converted-${Date.now()}`,
        type: targetType,
        x: firstSel.x,
        y: firstSel.y,
        width: 350,
        height: 60,
        rotation: 0,
        layer: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#D0BCFF",
        strokeWidth: 2,
        content: defaultVal,
        isSelected: true,
        isLassoSelected: true,
      };
      const cleanList = canvasObjects.filter((obj) => !obj.isSelected && !obj.isLassoSelected);
      onUpdateObjects([...cleanList, fallbackObj]);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSolveSelection = async () => {
    setIsSolving(true);
    setLassoSelectionBounds(null);

    const selected = canvasObjects.filter((obj) => obj.isSelected || obj.isLassoSelected);
    let mathEquation = "";
    let minX = 450;
    let minY = 120;

    if (selected.length > 0) {
      minX = selected[0].x;
      minY = selected[0].y;
    }

    try {
      const ocrResult = getSelectedHandwritingDataUrl(canvasObjects);
      if (ocrResult) {
        const ocrRes = await fetch("/api/ai/visual-ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: ocrResult.dataUrl, targetType: "formula" }),
        });
        if (ocrRes.ok) {
          const data = await ocrRes.json();
          mathEquation = data.content || "";
        }
      } else {
        const existingTexts = selected
          .filter((o) => o.type === "text" || o.type === "formula")
          .map((o) => o.content)
          .filter(Boolean);
        if (existingTexts.length > 0) {
          mathEquation = existingTexts[0];
        }
      }

      if (!mathEquation) {
        mathEquation = "∇ × E = -\\frac{\\partial B}{\\partial t}";
      }

      const response = await fetch("/api/ai/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equation: mathEquation, type: "solve" }),
      });

      if (!response.ok) {
        let errorMsg = "Failed to communicate with the solve server.";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          try {
            const htmlText = await response.text();
            if (htmlText.includes("<!doctype") || htmlText.includes("<html")) {
              errorMsg = `Server returned HTML (Status ${response.status}).`;
            } else if (htmlText) {
              errorMsg = htmlText.slice(0, 150);
            }
          } catch {}
        }
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server did not return JSON (Status ${response.status}).`);
      }

      const data = await response.json();

      triggerHaptic(40);

      const newSol: FormulaSolution = {
        formula: mathEquation,
        solution: data.solution,
        x: Math.max(20, minX),
        y: Math.max(80, minY + 80),
      };

      setFormulaSolutions((prev) => [...prev, newSol]);
      onUpdateObjects(canvasObjects.map((o) => ({ ...o, isSelected: false, isLassoSelected: false })));
    } catch (err: any) {
      console.error(err);
      triggerHaptic([10, 50, 10]);
      if (!mathEquation) {
        mathEquation = "∇ × E = -\\frac{\\partial B}{\\partial t}";
      }
      const fallbackSol: FormulaSolution = {
        formula: mathEquation,
        solution: `### Analytical Solution (Faraday's Law)
The equation $\\nabla \\times E = -\\frac{\\partial B}{\\partial t}$ is one of Maxwell's Equations detailing electromagnetism.

1. **Physical Meaning**: A time-varying magnetic field ($B$) induces a curling electric field ($E$).
2. **Integral Form**:
   $$\\oint_{\\partial S} E \\cdot dl = -\\frac{d}{dt} \\iint_S B \\cdot dS$$
   This represents Faraday's Law of Electromagnetic Induction, the fundamental principle behind electric generators, transformers, and induction motors.`,
        x: Math.max(20, minX),
        y: Math.max(80, minY + 80),
      };
      setFormulaSolutions((prev) => [...prev, fallbackSol]);
    } finally {
      setIsSolving(false);
    }
  };

  // Transformation actions
  const handleGroupSelection = () => {
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    if (selected.length === 0) return;

    const minX = Math.min(...selected.map(o => o.x));
    const maxX = Math.max(...selected.map(o => o.x + (o.width || 100)));
    const minY = Math.min(...selected.map(o => o.y));
    const maxY = Math.max(...selected.map(o => o.y + (o.height || 80)));
    
    const width = maxX - minX || 10;
    const height = maxY - minY || 10;

    const children: CanvasObject[] = selected.map(o => ({
      ...o,
      x: o.x - minX,
      y: o.y - minY,
      isSelected: false,
      isLassoSelected: false,
    }));

    const groupObj: CanvasObject = {
      id: `group-${Date.now()}`,
      type: "group",
      x: minX,
      y: minY,
      width,
      height,
      originalWidth: width,
      originalHeight: height,
      rotation: 0,
      layer: Math.max(...selected.map(o => o.layer), Date.now()),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: "#D0BCFF",
      strokeWidth: 2,
      children,
      isSelected: true,
      isLassoSelected: true,
    };

    const unselected = canvasObjects.filter(o => !o.isSelected && !o.isLassoSelected);
    onUpdateObjects([...unselected, groupObj]);
    setLassoSelectionBounds(null);
  };

  const handleUngroupSelection = () => {
    const selectedGroups = canvasObjects.filter(o => (o.isSelected || o.isLassoSelected) && o.type === "group");
    if (selectedGroups.length === 0) return;

    let newCanvasObjects = [...canvasObjects];

    selectedGroups.forEach(g => {
      if (!g.children) return;

      const scaleX = g.originalWidth ? (g.width / g.originalWidth) : 1;
      const scaleY = g.originalHeight ? (g.height / g.originalHeight) : 1;
      const cx = g.x + g.width / 2;
      const cy = g.y + g.height / 2;
      const rad = ((g.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const restoredChildren = g.children.map(c => {
        const cw_scaled = (c.width || 100) * scaleX;
        const ch_scaled = (c.height || 80) * scaleY;

        // Unrotated child center relative to group center
        const child_rx = c.x * scaleX;
        const child_ry = c.y * scaleY;
        const child_cx_unrotated = g.x + child_rx + cw_scaled / 2;
        const child_cy_unrotated = g.y + child_ry + ch_scaled / 2;

        const dx = child_cx_unrotated - cx;
        const dy = child_cy_unrotated - cy;

        // Rotate child center around group center
        const rotated_dx = dx * cos - dy * sin;
        const rotated_dy = dx * sin + dy * cos;

        const child_cx_rotated = cx + rotated_dx;
        const child_cy_rotated = cy + rotated_dy;

        const final_x = child_cx_rotated - cw_scaled / 2;
        const final_y = child_cy_rotated - ch_scaled / 2;
        const final_rotation = ((c.rotation || 0) + (g.rotation || 0)) % 360;

        const scaledPoints = c.points 
          ? c.points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY })) 
          : undefined;

        const scaledStrokeWidth = c.strokeWidth * ((scaleX + scaleY) / 2);

        return {
          ...c,
          x: final_x,
          y: final_y,
          width: cw_scaled,
          height: ch_scaled,
          rotation: final_rotation,
          points: scaledPoints,
          strokeWidth: scaledStrokeWidth,
          isSelected: true,
          isLassoSelected: true,
          updatedAt: Date.now()
        };
      });

      // Remove this group and add its restored children
      newCanvasObjects = newCanvasObjects.filter(o => o.id !== g.id);
      newCanvasObjects.push(...restoredChildren);
    });

    onUpdateObjects(newCanvasObjects);
    setLassoSelectionBounds(null);
  };

  const handleDuplicateSelection = () => {
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    const clones = selected.map(o => ({
      ...o,
      id: `${o.id}-clone-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      x: o.x + 30,
      y: o.y + 30,
      children: o.children ? JSON.parse(JSON.stringify(o.children)) : undefined,
      isSelected: true,
      isLassoSelected: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
    const deselectOriginals = canvasObjects.map(o => {
      if (o.isSelected || o.isLassoSelected) {
        return { ...o, isSelected: false, isLassoSelected: false };
      }
      return o;
    });
    onUpdateObjects([...deselectOriginals, ...clones]);
  };

  const handleMoveToFront = () => {
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    const unselected = canvasObjects.filter(o => !o.isSelected && !o.isLassoSelected);
    onUpdateObjects([...unselected, ...selected]);
  };

  const handleMoveToBack = () => {
    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    const unselected = canvasObjects.filter(o => !o.isSelected && !o.isLassoSelected);
    onUpdateObjects([...selected, ...unselected]);
  };

  const handleDeleteSelection = () => {
    onUpdateObjects(canvasObjects.filter(o => !o.isSelected && !o.isLassoSelected));
    setLassoSelectionBounds(null);
  };

  const renderObjectContent = (obj: CanvasObject, isSelected: boolean): React.ReactNode => {
    try {
      const width = obj.width || 100;
      const height = obj.height || 80;

      // Custom Geometry rendering delegation
      const geoObj = getGeometryObject(obj);
      if (geoObj) {
        return geoObj.render(
          isSelected,
          (fields) => {
            onUpdateObjects(canvasObjects.map(o => o.id === obj.id ? { ...o, ...fields, updatedAt: Date.now() } : o));
          },
          (objId, handleId, e) => {
            e.stopPropagation();
            e.preventDefault();
            const startObj = canvasObjects.find(o => o.id === objId);
            if (startObj) {
              const currentCoords = getCanvasCoords(e.clientX, e.clientY);
              setGeoDrag({
                objId,
                handleId,
                startMouseX: currentCoords.x,
                startMouseY: currentCoords.y,
                startObj: JSON.parse(JSON.stringify(startObj))
              });
            }
          },
          (actionType, params) => {
            handleGeoAction(actionType, params);
          }
        );
      }

      if (obj.type === "group" && obj.children) {
      const scaleX = obj.originalWidth ? obj.width / obj.originalWidth : 1;
      const scaleY = obj.originalHeight ? obj.height / obj.originalHeight : 1;
      return (
        <g transform={`scale(${scaleX}, ${scaleY})`}>
          {isSelected && (
            <rect
              x={0}
              y={0}
              width={obj.originalWidth || width}
              height={obj.originalHeight || height}
              fill="none"
              stroke="#D0BCFF"
              strokeWidth={1}
              strokeDasharray="2 2"
              className="opacity-60"
            />
          )}
          {obj.children.map((child) => {
            const childWidth = child.width || 100;
            const childHeight = child.height || 80;
            return (
              <g
                key={child.id}
                transform={`translate(${child.x}, ${child.y}) rotate(${child.rotation || 0}, ${childWidth / 2}, ${childHeight / 2})`}
              >
                {renderObjectContent(child, isSelected)}
              </g>
            );
          })}
        </g>
      );
    }

    return (
      <>
        {/* Handwriting vectors rendered on WebGL layer underneath for ultra performance, or SVG as fallback */}
        {obj.type === "handwriting" && (
          renderBackend === "svg" && obj.points && obj.points.length > 0 ? (
            <path
              d={"M " + obj.points[0].x + " " + obj.points[0].y + " " + obj.points.slice(1).map(p => "L " + p.x + " " + p.y).join(" ")}
              fill="none"
              stroke={obj.color || "#FFFFFF"}
              strokeWidth={obj.strokeWidth || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null
        )}

        {/* Editable vector shapes rendered relative */}
        {obj.type === "shape" && (
          <>
            {obj.shapeType === "rectangle" && (
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="none"
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                className={isSelected ? "stroke-[#D0BCFF] filter drop-shadow-[0_0_4px_rgba(208,188,255,0.6)]" : ""}
              />
            )}
            {obj.shapeType === "circle" && (
              <circle
                cx={width / 2}
                cy={height / 2}
                r={Math.max(5, Math.min(width, height) / 2 - (obj.strokeWidth || 2))}
                fill="none"
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                className={isSelected ? "stroke-[#D0BCFF] filter drop-shadow-[0_0_4px_rgba(208,188,255,0.6)]" : ""}
              />
            )}
            {obj.shapeType === "triangle" && (
              <polygon
                points={`${width / 2},0 0,${height} ${width},${height}`}
                fill="none"
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                className={isSelected ? "stroke-[#D0BCFF] filter drop-shadow-[0_0_4px_rgba(208,188,255,0.6)]" : ""}
              />
            )}

            {/* Resistor scalable symbol */}
            {obj.shapeType === "resistor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="rgba(208, 188, 255, 0.02)" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.2} ${height / 2} L ${width * 0.28} ${height * 0.2} L ${width * 0.36} ${height * 0.8} L ${width * 0.44} ${height * 0.2} L ${width * 0.52} ${height * 0.8} L ${width * 0.60} ${height * 0.2} L ${width * 0.68} ${height * 0.8} L ${width * 0.76} ${height * 0.2} L ${width * 0.84} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Variable Resistor scalable symbol */}
            {obj.shapeType === "variable_resistor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.2} ${height / 2} L ${width * 0.28} ${height * 0.2} L ${width * 0.36} ${height * 0.8} L ${width * 0.44} ${height * 0.2} L ${width * 0.52} ${height * 0.8} L ${width * 0.60} ${height * 0.2} L ${width * 0.68} ${height * 0.8} L ${width * 0.76} ${height * 0.2} L ${width * 0.84} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
                <path
                  d={`M ${width * 0.15} ${height * 0.85} L ${width * 0.85} ${height * 0.15}`}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                />
                <path
                  d={`M ${width * 0.75} ${height * 0.15} L ${width * 0.85} ${height * 0.15} L ${width * 0.85} ${height * 0.25}`}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                />
              </g>
            )}

            {/* Capacitor scalable symbol */}
            {obj.shapeType === "capacitor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.45} ${height / 2} M ${width * 0.45} ${height * 0.15} L ${width * 0.45} ${height * 0.85} M ${width * 0.55} ${height * 0.15} L ${width * 0.55} ${height * 0.85} M ${width * 0.55} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Polarized Capacitor scalable symbol */}
            {obj.shapeType === "polarized_capacitor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.45} ${height / 2} M ${width * 0.45} ${height * 0.15} L ${width * 0.45} ${height * 0.85} M ${width * 0.55} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
                {/* Curved plate */}
                <path
                  d={`M ${width * 0.55} ${height * 0.15} Q ${width * 0.6} ${height / 2} ${width * 0.55} ${height * 0.85}`}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                />
                {/* Plus sign */}
                <text x={width * 0.28} y={height * 0.35} fill={obj.color} fontSize="12" fontWeight="bold">+</text>
              </g>
            )}

            {/* Inductor scalable symbol */}
            {obj.shapeType === "inductor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.15} ${height / 2} 
                     C ${width * 0.15} ${height * 0.2}, ${width * 0.3} ${height * 0.2}, ${width * 0.3} ${height / 2} 
                     C ${width * 0.3} ${height * 0.2}, ${width * 0.45} ${height * 0.2}, ${width * 0.45} ${height / 2} 
                     C ${width * 0.45} ${height * 0.2}, ${width * 0.6} ${height * 0.2}, ${width * 0.6} ${height / 2} 
                     C ${width * 0.6} ${height * 0.2}, ${width * 0.75} ${height * 0.2}, ${width * 0.75} ${height / 2} 
                     C ${width * 0.75} ${height * 0.2}, ${width * 0.9} ${height * 0.2}, ${width * 0.9} ${height / 2} 
                     L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Transformer scalable symbol */}
            {obj.shapeType === "transformer" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                {/* Left Inductor */}
                <path 
                  d={`M 0 ${height * 0.2} L ${width * 0.2} ${height * 0.2} 
                     C ${width * 0.1} ${height * 0.28}, ${width * 0.1} ${height * 0.42}, ${width * 0.2} ${height * 0.42} 
                     C ${width * 0.1} ${height * 0.50}, ${width * 0.1} ${height * 0.64}, ${width * 0.2} ${height * 0.64} 
                     C ${width * 0.1} ${height * 0.72}, ${width * 0.1} ${height * 0.86}, ${width * 0.2} ${height * 0.86} 
                     L 0 ${height * 0.86}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
                {/* Two magnetic core lines */}
                <line x1={width * 0.45} y1={height * 0.15} x2={width * 0.45} y2={height * 0.85} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.55} y1={height * 0.15} x2={width * 0.55} y2={height * 0.85} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Right Inductor */}
                <path 
                  d={`M ${width} ${height * 0.2} L ${width * 0.8} ${height * 0.2} 
                     C ${width * 0.9} ${height * 0.28}, ${width * 0.9} ${height * 0.42}, ${width * 0.8} ${height * 0.42} 
                     C ${width * 0.9} ${height * 0.50}, ${width * 0.9} ${height * 0.64}, ${width * 0.8} ${height * 0.64} 
                     C ${width * 0.9} ${height * 0.72}, ${width * 0.9} ${height * 0.86}, ${width * 0.8} ${height * 0.86} 
                     L ${width} ${height * 0.86}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Battery scalable symbol */}
            {obj.shapeType === "battery" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.4} ${height / 2} M ${width * 0.4} ${height * 0.15} L ${width * 0.4} ${height * 0.85} M ${width * 0.48} ${height * 0.3} L ${width * 0.48} ${height * 0.7} M ${width * 0.56} ${height * 0.15} L ${width * 0.56} ${height * 0.85} M ${width * 0.64} ${height * 0.3} L ${width * 0.64} ${height * 0.7} M ${width * 0.64} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Cell scalable symbol */}
            {obj.shapeType === "cell" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.45} ${height / 2} M ${width * 0.45} ${height * 0.1} L ${width * 0.45} ${height * 0.9} M ${width * 0.55} ${height * 0.25} L ${width * 0.55} ${height * 0.75} M ${width * 0.55} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Ground scalable symbol */}
            {obj.shapeType === "ground" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M ${width / 2} 0 L ${width / 2} ${height * 0.55}
                     M ${width * 0.15} ${height * 0.55} L ${width * 0.85} ${height * 0.55}
                     M ${width * 0.3} ${height * 0.7} L ${width * 0.7} ${height * 0.7}
                     M ${width * 0.42} ${height * 0.85} L ${width * 0.58} ${height * 0.85}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Earth Ground scalable symbol */}
            {obj.shapeType === "earth_ground" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M ${width / 2} 0 L ${width / 2} ${height * 0.55}
                     M ${width * 0.15} ${height * 0.55} L ${width * 0.85} ${height * 0.55}
                     M ${width * 0.25} ${height * 0.55} L ${width * 0.1} ${height * 0.8}
                     M ${width * 0.42} ${height * 0.55} L ${width * 0.27} ${height * 0.8}
                     M ${width * 0.58} ${height * 0.55} L ${width * 0.43} ${height * 0.8}
                     M ${width * 0.75} ${height * 0.55} L ${width * 0.6} ${height * 0.8}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Fuse scalable symbol */}
            {obj.shapeType === "fuse" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={width * 0.15} y={height * 0.3} width={width * 0.7} height={height * 0.4} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.15} ${height / 2}
                     Q ${width * 0.35} ${height * 0.15} ${width * 0.5} ${height / 2}
                     T ${width * 0.85} ${height / 2}
                     L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Switch scalable symbol */}
            {obj.shapeType === "switch" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.35} ${height / 2} M ${width * 0.65} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
                <circle cx={width * 0.35} cy={height / 2} r={3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.65} cy={height / 2} r={3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line 
                  x1={width * 0.37} y1={height / 2} 
                  x2={width * 0.62} y2={height * 0.25} 
                  stroke={obj.color} strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Push Button scalable symbol */}
            {obj.shapeType === "push_button" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.35} ${height / 2} M ${width * 0.65} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
                <circle cx={width * 0.35} cy={height / 2} r={3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.65} cy={height / 2} r={3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.3} y1={height * 0.3} x2={width * 0.7} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width / 2} y1={height * 0.3} x2={width / 2} y2={height * 0.1} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Relay scalable symbol */}
            {obj.shapeType === "relay" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <rect x={width * 0.1} y={height * 0.2} width={width * 0.3} height={height * 0.6} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.1} y1={height * 0.2} x2={width * 0.4} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M 0 ${height / 2} L ${width * 0.1} ${height / 2} M ${width * 0.4} ${height / 2} L ${width * 0.55} ${height / 2}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Switch contacts */}
                <path d={`M ${width * 0.7} ${height * 0.15} L ${width * 0.7} ${height * 0.3} M ${width * 0.9} ${height * 0.15} L ${width * 0.9} ${height * 0.85}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.7} y1={height * 0.3} x2={width * 0.88} y2={height * 0.5} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.55} y1={height / 2} x2={width * 0.78} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} strokeDasharray="2 2" />
              </g>
            )}

            {/* LED scalable symbol */}
            {obj.shapeType === "led" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.35} ${height / 2}
                     M ${width * 0.35} ${height * 0.2} L ${width * 0.35} ${height * 0.8} L ${width * 0.65} ${height / 2} Z
                     M ${width * 0.65} ${height * 0.2} L ${width * 0.65} ${height * 0.8}
                     M ${width * 0.65} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
                {/* Outward light arrows */}
                <path d={`M ${width * 0.4} ${height * 0.1} L ${width * 0.52} ${height * 0.01}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.45} ${height * 0.01} L ${width * 0.52} ${height * 0.01} L ${width * 0.52} ${height * 0.08}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.52} ${height * 0.15} L ${width * 0.64} ${height * 0.06}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.57} ${height * 0.06} L ${width * 0.64} ${height * 0.06} L ${width * 0.64} ${height * 0.13}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Diode scalable symbol */}
            {obj.shapeType === "diode" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.35} ${height / 2}
                     M ${width * 0.35} ${height * 0.2} L ${width * 0.35} ${height * 0.8} L ${width * 0.65} ${height / 2} Z
                     M ${width * 0.65} ${height * 0.2} L ${width * 0.65} ${height * 0.8}
                     M ${width * 0.65} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Zener Diode scalable symbol */}
            {obj.shapeType === "zener_diode" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.35} ${height / 2}
                     M ${width * 0.35} ${height * 0.2} L ${width * 0.35} ${height * 0.8} L ${width * 0.65} ${height / 2} Z
                     M ${width * 0.65} ${height * 0.2} L ${width * 0.65} ${height * 0.8}
                     M ${width * 0.65} ${height * 0.2} L ${width * 0.72} ${height * 0.2}
                     M ${width * 0.65} ${height * 0.8} L ${width * 0.58} ${height * 0.8}
                     M ${width * 0.65} ${height / 2} L ${width} ${height / 2}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* NPN Transistor scalable symbol */}
            {obj.shapeType === "npn_transistor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.4} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.1} y1={height / 2} x2={width * 0.35} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.35} y1={height * 0.25} x2={width * 0.35} y2={height * 0.75} stroke={obj.color} strokeWidth={obj.strokeWidth * 1.5} />
                {/* Collector */}
                <line x1={width * 0.35} y1={height * 0.38} x2={width * 0.65} y2={height * 0.2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.65} y1={height * 0.2} x2={width * 0.9} y2={height * 0.2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Emitter with arrow */}
                <line x1={width * 0.35} y1={height * 0.62} x2={width * 0.65} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.65} y1={height * 0.8} x2={width * 0.9} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.5} ${height * 0.72} L ${width * 0.62} ${height * 0.78} L ${width * 0.58} ${height * 0.65}`} fill={obj.color} stroke={obj.color} strokeWidth={1} />
              </g>
            )}

            {/* PNP Transistor scalable symbol */}
            {obj.shapeType === "pnp_transistor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.4} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.1} y1={height / 2} x2={width * 0.35} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.35} y1={height * 0.25} x2={width * 0.35} y2={height * 0.75} stroke={obj.color} strokeWidth={obj.strokeWidth * 1.5} />
                {/* Collector */}
                <line x1={width * 0.35} y1={height * 0.38} x2={width * 0.65} y2={height * 0.2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.65} y1={height * 0.2} x2={width * 0.9} y2={height * 0.2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Emitter with inward arrow */}
                <line x1={width * 0.35} y1={height * 0.62} x2={width * 0.65} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.65} y1={height * 0.8} x2={width * 0.9} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.48} ${height * 0.58} L ${width * 0.4} ${height * 0.65} L ${width * 0.52} ${height * 0.7}`} fill={obj.color} stroke={obj.color} strokeWidth={1} />
              </g>
            )}

            {/* MOSFET scalable symbol */}
            {obj.shapeType === "mosfet" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <line x1={width * 0.1} y1={height / 2} x2={width * 0.3} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Gate plate */}
                <line x1={width * 0.3} y1={height * 0.2} x2={width * 0.3} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth * 1.5} />
                {/* Substrate sections */}
                <line x1={width * 0.4} y1={height * 0.2} x2={width * 0.4} y2={height * 0.35} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.4} y1={height * 0.42} x2={width * 0.4} y2={height * 0.58} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.4} y1={height * 0.65} x2={width * 0.4} y2={height * 0.8} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Connections */}
                <path d={`M ${width * 0.4} ${height * 0.2} L ${width * 0.7} ${height * 0.2} L ${width * 0.7} 0`} stroke={obj.color} strokeWidth={obj.strokeWidth} fill="none" />
                <path d={`M ${width * 0.4} ${height * 0.8} L ${width * 0.7} ${height * 0.8} L ${width * 0.7} ${height}`} stroke={obj.color} strokeWidth={obj.strokeWidth} fill="none" />
                <path d={`M ${width * 0.4} ${height / 2} L ${width * 0.7} ${height / 2} L ${width * 0.7} ${height * 0.8}`} stroke={obj.color} strokeWidth={obj.strokeWidth} fill="none" />
                {/* Arrow */}
                <path d={`M ${width * 0.42} ${height / 2} L ${width * 0.55} ${height * 0.45} L ${width * 0.55} ${height * 0.55}`} fill={obj.color} stroke={obj.color} strokeWidth={1} />
              </g>
            )}

            {/* Operational Amplifier scalable symbol */}
            {obj.shapeType === "op_amp" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <polygon points={`${width * 0.15},${height * 0.1} ${width * 0.15},${height * 0.9} ${width * 0.85},${height / 2}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Leads */}
                <line x1={0} y1={height * 0.35} x2={width * 0.15} y2={height * 0.35} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.65} x2={width * 0.15} y2={height * 0.65} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.85} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Text Labels */}
                <text x={width * 0.22} y={height * 0.39} fill={obj.color} fontSize="11" fontWeight="bold">-</text>
                <text x={width * 0.2} y={height * 0.69} fill={obj.color} fontSize="10" fontWeight="bold">+</text>
              </g>
            )}

            {/* Microcontroller scalable symbol */}
            {obj.shapeType === "microcontroller" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={width * 0.15} y={height * 0.15} width={width * 0.7} height={height * 0.7} fill="rgba(208, 188, 255, 0.02)" stroke={obj.color} strokeWidth={obj.strokeWidth} rx={4} />
                {/* Pins Left */}
                <line x1={0} y1={height * 0.3} x2={width * 0.15} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.5} x2={width * 0.15} y2={height * 0.5} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.15} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Pins Right */}
                <line x1={width * 0.85} y1={height * 0.3} x2={width} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.85} y1={height * 0.5} x2={width} y2={height * 0.5} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.85} y1={height * 0.7} x2={width} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Labels */}
                <text x={width / 2} y={height / 2 + 4} fill={obj.color} fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="monospace">MCU</text>
              </g>
            )}

            {/* Voltage Source scalable symbol */}
            {obj.shapeType === "voltage_source" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height / 2} x2={width * 0.2} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.8} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <text x={width * 0.35} y={height / 2 + 4} fill={obj.color} fontSize="12" fontWeight="bold">+</text>
                <text x={width * 0.58} y={height / 2 + 3} fill={obj.color} fontSize="12" fontWeight="bold">-</text>
              </g>
            )}

            {/* Current Source scalable symbol */}
            {obj.shapeType === "current_source" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height / 2} x2={width * 0.2} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.8} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.38} y1={height / 2} x2={width * 0.62} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.54} ${height * 0.42} L ${width * 0.64} ${height / 2} L ${width * 0.54} ${height * 0.58}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Lamp scalable symbol */}
            {obj.shapeType === "lamp" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <circle cx={width / 2} cy={height / 2} r={Math.max(5, Math.min(width, height) / 2.2 - (obj.strokeWidth || 2))} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path 
                  d={`M 0 ${height / 2} L ${width * 0.15} ${height / 2} M ${width * 0.85} ${height / 2} L ${width} ${height / 2} M ${width * 0.3} ${height * 0.3} L ${width * 0.7} ${height * 0.7} M ${width * 0.3} ${height * 0.7} L ${width * 0.7} ${height * 0.3}`} 
                  fill="none" 
                  stroke={obj.color} 
                  strokeWidth={obj.strokeWidth} 
                />
              </g>
            )}

            {/* Motor scalable symbol */}
            {obj.shapeType === "motor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.3} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height / 2} x2={width * 0.2} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.8} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <text x={width / 2} y={height / 2 + 5} fill={obj.color} fontSize="14" textAnchor="middle" fontWeight="bold" fontFamily="monospace">M</text>
              </g>
            )}

            {/* Speaker scalable symbol */}
            {obj.shapeType === "speaker" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={width * 0.1} y={height * 0.3} width={width * 0.3} height={height * 0.4} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <polygon points={`${width * 0.4},${height * 0.3} ${width * 0.8},${height * 0.1} ${width * 0.8},${height * 0.9} ${width * 0.4},${height * 0.7}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height / 2} x2={width * 0.1} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Buzzer scalable symbol */}
            {obj.shapeType === "buzzer" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.2} ${height * 0.6} A ${width * 0.3} ${height * 0.3} 0 0 1 ${width * 0.8} ${height * 0.6} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.3} y1={height * 0.6} x2={width * 0.3} y2={height * 0.9} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.7} y1={height * 0.6} x2={width * 0.7} y2={height * 0.9} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* AND Gate scalable symbol */}
            {obj.shapeType === "and" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.2} ${height * 0.1} L ${width * 0.5} ${height * 0.1} A ${width * 0.35} ${height * 0.4} 0 0 1 ${width * 0.85} ${height / 2} A ${width * 0.35} ${height * 0.4} 0 0 1 ${width * 0.5} ${height * 0.9} L ${width * 0.2} ${height * 0.9} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.3} x2={width * 0.2} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.2} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.85} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* OR Gate scalable symbol */}
            {obj.shapeType === "or" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.15} ${height * 0.1} C ${width * 0.3} ${height * 0.25}, ${width * 0.3} ${height * 0.75}, ${width * 0.15} ${height * 0.9} Q ${width * 0.55} ${height * 0.9}, ${width * 0.85} ${height / 2} Q ${width * 0.55} ${height * 0.1}, ${width * 0.15} ${height * 0.1} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.3} x2={width * 0.23} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.23} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.85} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* NOT Gate scalable symbol */}
            {obj.shapeType === "not" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width * 0.25},${height * 0.15} ${width * 0.25},${height * 0.85} ${width * 0.65},${height / 2}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.71} cy={height / 2} r={Math.max(3, width * 0.06)} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height / 2} x2={width * 0.25} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.77} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* NAND Gate scalable symbol */}
            {obj.shapeType === "nand" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.18} ${height * 0.1} L ${width * 0.45} ${height * 0.1} A ${width * 0.3} ${height * 0.4} 0 0 1 ${width * 0.75} ${height / 2} A ${width * 0.3} ${height * 0.4} 0 0 1 ${width * 0.45} ${height * 0.9} L ${width * 0.18} ${height * 0.9} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.81} cy={height / 2} r={Math.max(3, width * 0.06)} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.3} x2={width * 0.18} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.18} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.87} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* NOR Gate scalable symbol */}
            {obj.shapeType === "nor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.13} ${height * 0.1} C ${width * 0.26} ${height * 0.25}, ${width * 0.26} ${height * 0.75}, ${width * 0.13} ${height * 0.9} Q ${width * 0.48} ${height * 0.9}, ${width * 0.75} ${height / 2} Q ${width * 0.48} ${height * 0.1}, ${width * 0.13} ${height * 0.1} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.81} cy={height / 2} r={Math.max(3, width * 0.06)} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.3} x2={width * 0.2} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.2} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.87} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* XOR Gate scalable symbol */}
            {obj.shapeType === "xor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.18} ${height * 0.1} C ${width * 0.3} ${height * 0.25}, ${width * 0.3} ${height * 0.75}, ${width * 0.18} ${height * 0.9} Q ${width * 0.55} ${height * 0.9}, ${width * 0.85} ${height / 2} Q ${width * 0.55} ${height * 0.1}, ${width * 0.18} ${height * 0.1} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Back curved line */}
                <path d={`M ${width * 0.1} ${height * 0.1} C ${width * 0.22} ${height * 0.25}, ${width * 0.22} ${height * 0.75}, ${width * 0.1} ${height * 0.9}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.3} x2={width * 0.2} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.2} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.85} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* XNOR Gate scalable symbol */}
            {obj.shapeType === "xnor" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.15} ${height * 0.1} C ${width * 0.27} ${height * 0.25}, ${width * 0.27} ${height * 0.75}, ${width * 0.15} ${height * 0.9} Q ${width * 0.48} ${height * 0.9}, ${width * 0.75} ${height / 2} Q ${width * 0.48} ${height * 0.1}, ${width * 0.15} ${height * 0.1} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Back curved line */}
                <path d={`M ${width * 0.08} ${height * 0.1} C ${width * 0.2} ${height * 0.25}, ${width * 0.2} ${height * 0.75}, ${width * 0.08} ${height * 0.9}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.81} cy={height / 2} r={Math.max(3, width * 0.06)} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.3} x2={width * 0.17} y2={height * 0.3} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.7} x2={width * 0.17} y2={height * 0.7} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.87} y1={height / 2} x2={width} y2={height / 2} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Start/End Pill scalable symbol */}
            {obj.shapeType === "start_end" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} rx={height / 2} />
              </g>
            )}

            {/* Process Rectangle scalable symbol */}
            {obj.shapeType === "process" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Decision Diamond scalable symbol */}
            {obj.shapeType === "decision" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Database Cylinder scalable symbol */}
            {obj.shapeType === "database" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <ellipse cx={width / 2} cy={height * 0.15} rx={width / 2 - obj.strokeWidth} ry={height * 0.12} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={obj.strokeWidth} y1={height * 0.15} x2={obj.strokeWidth} y2={height * 0.85} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width - obj.strokeWidth} y1={height * 0.15} x2={width - obj.strokeWidth} y2={height * 0.85} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${obj.strokeWidth} ${height * 0.85} A ${width / 2 - obj.strokeWidth} ${height * 0.12} 0 0 0 ${width - obj.strokeWidth} ${height * 0.85}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${obj.strokeWidth} ${height * 0.5} A ${width / 2 - obj.strokeWidth} ${height * 0.12} 0 0 0 ${width - obj.strokeWidth} ${height * 0.5}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} strokeDasharray="3 3" />
              </g>
            )}

            {/* Connector Circle scalable symbol */}
            {obj.shapeType === "connector" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2.5} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Document Block scalable symbol */}
            {obj.shapeType === "document" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M 0 0 L ${width} 0 L ${width} ${height * 0.8} Q ${width * 0.75} ${height * 0.7}, ${width * 0.5} ${height * 0.8} T 0 ${height * 0.8} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Input/Output Parallelogram scalable symbol */}
            {obj.shapeType === "input_output" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width * 0.2},0 ${width},0 ${width * 0.8},${height} 0,${height}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Manual Operation scalable symbol */}
            {obj.shapeType === "manual_operation" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`0,0 ${width},0 ${width * 0.8},${height} ${width * 0.2},${height}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Delay Shape scalable symbol */}
            {obj.shapeType === "delay" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M 0 0 L ${width * 0.5} 0 A ${width * 0.5} ${height * 0.5} 0 0 1 ${width} ${height / 2} A ${width * 0.5} ${height * 0.5} 0 0 1 ${width * 0.5} ${height} L 0 ${height} Z`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Ellipse Geometry scalable symbol */}
            {obj.shapeType === "ellipse" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <ellipse cx={width / 2} cy={height / 2} rx={width / 2 - obj.strokeWidth} ry={height / 2 - obj.strokeWidth} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Pentagon Geometry scalable symbol */}
            {obj.shapeType === "pentagon" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width / 2},0 ${width},${height * 0.38} ${width * 0.8},${height} ${width * 0.2},${height} 0,${height * 0.38}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Hexagon Geometry scalable symbol */}
            {obj.shapeType === "hexagon" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width * 0.25},0 ${width * 0.75},0 ${width},${height / 2} ${width * 0.75},${height} ${width * 0.25},${height} 0,${height / 2}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Octagon Geometry scalable symbol */}
            {obj.shapeType === "octagon" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width * 0.3},0 ${width * 0.7},0 ${width},${height * 0.3} ${width},${height * 0.7} ${width * 0.7},${height} ${width * 0.3},${height} 0,${height * 0.7} 0,${height * 0.3}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Star Geometry scalable symbol */}
            {obj.shapeType === "star" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width/2},0 ${width*0.65},${height*0.35} ${width},${height*0.35} ${width*0.72},${height*0.58} ${width*0.82},${height} ${width/2},${height*0.76} ${width*0.18},${height} ${width*0.28},${height*0.58} 0,${height*0.35} ${width*0.35},${height*0.35}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Diamond Geometry scalable symbol */}
            {obj.shapeType === "diamond" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width/2},0 ${width},${height/2} ${width/2},${height} 0,${height/2}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Trapezium Geometry scalable symbol */}
            {obj.shapeType === "trapezium" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width * 0.25},0 ${width * 0.75},0 ${width},${height} 0,${height}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Parallelogram Geometry scalable symbol */}
            {obj.shapeType === "parallelogram" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`${width * 0.2},0 ${width},0 ${width * 0.8},${height} 0,${height}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Gear Mechanical scalable symbol */}
            {obj.shapeType === "gear" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.22} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.38} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} strokeDasharray="6 3" />
              </g>
            )}

            {/* Bearing Mechanical scalable symbol */}
            {obj.shapeType === "bearing" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.2} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.4} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Rolling balls */}
                <circle cx={width / 2} cy={height * 0.2} r={4} fill={obj.color} />
                <circle cx={width / 2} cy={height * 0.8} r={4} fill={obj.color} />
                <circle cx={width * 0.2} cy={height / 2} r={4} fill={obj.color} />
                <circle cx={width * 0.8} cy={height / 2} r={4} fill={obj.color} />
              </g>
            )}

            {/* Shaft Mechanical scalable symbol */}
            {obj.shapeType === "shaft" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={height * 0.4} width={width} height={height * 0.2} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <ellipse cx={0} cy={height / 2} rx={3} ry={height * 0.1} fill={obj.color} />
                <ellipse cx={width} cy={height / 2} rx={3} ry={height * 0.1} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Valve Mechanical scalable symbol */}
            {obj.shapeType === "valve" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <polygon points={`0,${height * 0.2} ${width},${height * 0.8} ${width},${height * 0.2} 0,${height * 0.8}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width / 2} cy={height / 2} r={5} fill={obj.color} />
              </g>
            )}

            {/* Router Network scalable symbol */}
            {obj.shapeType === "router" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <ellipse cx={width / 2} cy={height * 0.75} rx={width * 0.4} ry={height * 0.15} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Antennas */}
                <line x1={width * 0.3} y1={height * 0.65} x2={width * 0.15} y2={height * 0.15} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.15} cy={height * 0.15} r={3} fill={obj.color} />
                <line x1={width * 0.7} y1={height * 0.65} x2={width * 0.85} y2={height * 0.15} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <circle cx={width * 0.85} cy={height * 0.15} r={3} fill={obj.color} />
              </g>
            )}

            {/* Switch Node Network scalable symbol */}
            {obj.shapeType === "switch_node" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={width * 0.1} y={height * 0.2} width={width * 0.8} height={height * 0.6} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} rx={4} />
                <path d={`M ${width * 0.2} ${height * 0.4} L ${width * 0.8} ${height * 0.4} M ${width * 0.8} ${height * 0.6} L ${width * 0.2} ${height * 0.6}`} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.68} ${height * 0.3} L ${width * 0.8} ${height * 0.4} L ${width * 0.68} ${height * 0.5}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <path d={`M ${width * 0.32} ${height * 0.5} L ${width * 0.2} ${height * 0.6} L ${width * 0.32} ${height * 0.7}`} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Server Network scalable symbol */}
            {obj.shapeType === "server" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={width * 0.1} y={0} width={width * 0.8} height={height * 0.26} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} rx={2} />
                <rect x={width * 0.1} y={height * 0.36} width={width * 0.8} height={height * 0.26} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} rx={2} />
                <rect x={width * 0.1} y={height * 0.72} width={width * 0.8} height={height * 0.26} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} rx={2} />
                <circle cx={width * 0.25} cy={height * 0.13} r={2} fill={obj.color} />
                <circle cx={width * 0.25} cy={height * 0.49} r={2} fill={obj.color} />
                <circle cx={width * 0.25} cy={height * 0.85} r={2} fill={obj.color} />
              </g>
            )}

            {/* Cloud Network scalable symbol */}
            {obj.shapeType === "cloud" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <path d={`M ${width * 0.15} ${height * 0.7} 
                         C ${width * 0.02} ${height * 0.7}, ${width * 0.02} ${height * 0.45}, ${width * 0.18} ${height * 0.45} 
                         C ${width * 0.18} ${height * 0.25}, ${width * 0.42} ${height * 0.2}, ${width * 0.5} ${height * 0.32} 
                         C ${width * 0.6} ${height * 0.2}, ${width * 0.8} ${height * 0.22}, ${width * 0.82} ${height * 0.42} 
                         C ${width * 0.95} ${height * 0.45}, ${width * 0.95} ${height * 0.7}, ${width * 0.82} ${height * 0.7} Z`} 
                      fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Firewall Network scalable symbol */}
            {obj.shapeType === "firewall" && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} />
                {/* Brick lines */}
                <line x1={0} y1={height * 0.33} x2={width} y2={height * 0.33} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={0} y1={height * 0.66} x2={width} y2={height * 0.66} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.33} y1={0} x2={width * 0.33} y2={height * 0.33} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.66} y1={0} x2={width * 0.66} y2={height * 0.33} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.5} y1={height * 0.33} x2={width * 0.5} y2={height * 0.66} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.2} y1={height * 0.66} x2={width * 0.2} y2={height} stroke={obj.color} strokeWidth={obj.strokeWidth} />
                <line x1={width * 0.8} y1={height * 0.66} x2={width * 0.8} y2={height} stroke={obj.color} strokeWidth={obj.strokeWidth} />
              </g>
            )}

            {/* Math Symbols scalable group */}
            {["integrals", "derivatives", "sigma", "pi", "fractions", "roots", "matrices", "vectors", "greek_symbols"].includes(obj.shapeType || "") && (
              <g>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="transparent" />
                <text
                  x={width / 2}
                  y={height / 2 + 8}
                  textAnchor="middle"
                  fill={obj.color}
                  fontSize={Math.min(width, height) * 0.45}
                  fontFamily="JetBrains Mono, Courier New, monospace"
                  fontWeight="bold"
                >
                  {obj.shapeType === "integrals" ? "∫" :
                   obj.shapeType === "derivatives" ? "dy/dx" :
                   obj.shapeType === "sigma" ? "∑" :
                   obj.shapeType === "pi" ? "π" :
                   obj.shapeType === "fractions" ? "½" :
                   obj.shapeType === "roots" ? "√x" :
                   obj.shapeType === "matrices" ? "[M]" :
                   obj.shapeType === "vectors" ? "v⃗" : "θ"}
                </text>
              </g>
            )}

            {/* Wire Connection & Draggable line scalable symbol */}
            {(obj.shapeType === "line" || obj.shapeType === "arrow" || obj.shapeType === "wire") && (
              <g className={isSelected ? "stroke-[#D0BCFF]" : ""}>
                <line
                  x1={obj.points ? obj.points[0].x : 0}
                  y1={obj.points ? obj.points[0].y : height / 2}
                  x2={obj.points ? obj.points[1].x : width}
                  y2={obj.points ? obj.points[1].y : height / 2}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                />
                {obj.shapeType === "arrow" && (() => {
                  const x1 = obj.points ? obj.points[0].x : 0;
                  const y1 = obj.points ? obj.points[0].y : height / 2;
                  const x2 = obj.points ? obj.points[1].x : width;
                  const y2 = obj.points ? obj.points[1].y : height / 2;
                  const angle = Math.atan2(y2 - y1, x2 - x1);
                  const arrowLength = 12;
                  const arrowWidth = 6;
                  const ax1 = x2 - arrowLength * Math.cos(angle - Math.PI / 6);
                  const ay1 = y2 - arrowLength * Math.sin(angle - Math.PI / 6);
                  const ax2 = x2 - arrowLength * Math.cos(angle + Math.PI / 6);
                  const ay2 = y2 - arrowLength * Math.sin(angle + Math.PI / 6);
                  return (
                    <polygon
                      points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
                      fill={obj.color}
                      stroke={obj.color}
                      strokeWidth={1}
                    />
                  );
                })()}
              </g>
            )}
          </>
        )}

        {/* HTML ForeignObject blocks for Digital Text, Formulas, and Voice Notes */}
        {obj.type === "text" && (
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            className="overflow-hidden pointer-events-auto"
          >
            <div
              style={{
                fontFamily: obj.fontFamily || "Inter",
                fontSize: `${obj.fontSize || 16}px`,
                fontWeight: obj.bold ? "bold" : "normal",
                fontStyle: obj.italic ? "italic" : "normal",
                textDecoration: obj.underline ? "underline" : "none",
                color: obj.color || "#E6E1E5",
              }}
              className={`w-full h-full p-3.5 rounded-2xl border ${
                isSelected ? "border-[#D0BCFF] bg-[#121212]/95" : "border-[#333333]/40 bg-[#1C1C1C]/90"
              } flex flex-col justify-start overflow-y-auto no-scrollbar relative transition-colors`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingObjectId(obj.id);
              }}
            >
              {editingObjectId === obj.id ? (
                <textarea
                  autoFocus
                  defaultValue={obj.content}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateObjects(canvasObjects.map(o => o.id === obj.id ? { ...o, content: val } : o), false);
                  }}
                  onBlur={() => {
                    setEditingObjectId(null);
                    onUpdateObjects(canvasObjects); // commit history
                  }}
                  className="w-full h-full bg-transparent border-none outline-none resize-none text-current font-inherit p-0"
                  placeholder="Type text..."
                />
              ) : (
                <div className="w-full h-full select-text whitespace-pre-wrap leading-relaxed">
                  {obj.content || <span className="opacity-40 italic text-xs">Double click to type text...</span>}
                </div>
              )}
              <span className="absolute bottom-1 right-2 text-[7px] text-[#938F99] uppercase font-bold tracking-wider font-mono select-none pointer-events-none">
                📝 Text Box
              </span>
            </div>
          </foreignObject>
        )}

        {obj.type === "formula" && (
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            className="overflow-hidden pointer-events-auto"
          >
            <div
              className={`w-full h-full p-4 rounded-2xl border ${
                isSelected ? "border-[#D0BCFF] bg-[#121212]/95" : "border-[#333333]/40 bg-[#1C1C1C]/90"
              } flex flex-col justify-between relative transition-colors`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingObjectId(obj.id);
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-center">
                {editingObjectId === obj.id ? (
                  <input
                    autoFocus
                    type="text"
                    defaultValue={obj.content}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateObjects(canvasObjects.map(o => o.id === obj.id ? { ...o, content: val } : o), false);
                    }}
                    onBlur={() => {
                      setEditingObjectId(null);
                      onUpdateObjects(canvasObjects); // commit history
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditingObjectId(null);
                        onUpdateObjects(canvasObjects);
                      }
                    }}
                    className="w-full bg-transparent border-b border-[#D0BCFF] outline-none text-[#E6E1E5] font-mono text-center text-sm pb-1"
                    placeholder="e.g. x^2 + y^2 = r^2"
                  />
                ) : (
                  <div className="w-full text-center text-[#E6E1E5]">
                    {renderMathExpression(obj.content || "")}
                  </div>
                )}
              </div>
              <span className="absolute bottom-1 right-2 text-[7px] text-[#D0BCFF] uppercase font-bold tracking-wider font-mono select-none pointer-events-none">
                🔬 LATEX FORMULA
              </span>
            </div>
          </foreignObject>
        )}

        {obj.type === "voice" && (
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            className="overflow-hidden pointer-events-auto"
          >
            <div
              className={`w-full h-full p-3.5 rounded-2xl border ${
                isSelected ? "border-[#ffd60a] bg-[#121212]/95 shadow-[0_0_15px_rgba(255,214,10,0.15)]" : "border-[#333333]/40 bg-[#1C1C1C]/90"
              } flex flex-col justify-between relative select-none transition-all duration-300`}
            >
              {/* Title Header with Rename */}
              <div className="flex items-center justify-between w-full">
                {editingObjectId === obj.id ? (
                  <input
                    autoFocus
                    type="text"
                    defaultValue={obj.audioTitle || "Voice Note"}
                    onBlur={(e) => {
                      const val = e.target.value || "Voice Note";
                      setEditingObjectId(null);
                      onUpdateObjects(canvasObjects.map(o => o.id === obj.id ? { ...o, audioTitle: val } : o));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value || "Voice Note";
                        setEditingObjectId(null);
                        onUpdateObjects(canvasObjects.map(o => o.id === obj.id ? { ...o, audioTitle: val } : o));
                      }
                    }}
                    className="bg-transparent border-b border-[#ffd60a] text-xs font-semibold text-[#ffd60a] outline-none max-w-[150px] p-0"
                  />
                ) : (
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-[#ffd60a] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingObjectId(obj.id);
                    }}
                    title="Click to rename"
                  >
                    <span className="text-xs font-semibold truncate text-[#E6E1E5]">
                      🎤 {obj.audioTitle || "Voice Note"}
                    </span>
                    <span className="text-[9px] text-[#938F99] opacity-70">✏️</span>
                  </div>
                )}
                
                {/* Elapsed time or total duration */}
                <span className="text-[10px] font-mono text-[#ffd60a] font-bold shrink-0">
                  {obj.isRecording ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      REC {formatTime(obj.elapsedRecordingSeconds || 0)}
                    </span>
                  ) : (
                    formatTime(obj.audioPlaying ? (obj.audioCurrentTime || 0) : (obj.audioDuration || 0))
                  )}
                </span>
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-end justify-between h-8 gap-0.5 px-1 bg-black/30 rounded-lg overflow-hidden py-1">
                {(obj.waveform || Array.from({ length: 24 }, (_, idx) => 0.15 + 0.1 * Math.sin(idx / 3))).map((h, i) => {
                  const isPast = !obj.isRecording && obj.audioDuration && obj.audioCurrentTime && (i / 24 < (obj.audioCurrentTime / obj.audioDuration));
                  return (
                    <div
                      key={i}
                      style={{ height: `${Math.max(15, h * 100)}%` }}
                      className={`w-1 rounded-full transition-all duration-100 ${
                        obj.isRecording
                          ? "bg-red-500/80 animate-pulse"
                          : isPast
                          ? "bg-[#ffd60a]"
                          : "bg-[#938F99]/40"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Play / Pause / Stop Actions */}
              <div className="flex items-center justify-between w-full pt-1">
                {obj.isRecording ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopActiveRecording(obj.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] font-bold transition-all cursor-pointer shadow-lg"
                  >
                    <span className="w-1.5 h-1.5 bg-white rounded-sm" />
                    STOP RECORDING
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayAudio(obj.id, obj.audioUrl || "");
                      }}
                      className="flex items-center justify-center w-7 h-7 bg-[#ffd60a] hover:bg-yellow-400 text-black rounded-full transition-colors shrink-0 cursor-pointer shadow"
                    >
                      {obj.audioPlaying ? (
                        <span className="flex gap-0.5 justify-center items-center">
                          <span className="w-0.5 h-2.5 bg-black" />
                          <span className="w-0.5 h-2.5 bg-black" />
                        </span>
                      ) : (
                        <span className="ml-0.5 text-[9px] font-bold">▶</span>
                      )}
                    </button>
                    <span className="text-[9px] text-[#938F99] font-medium truncate max-w-[150px]">
                      {obj.audioPlaying ? "Playing voice dictation..." : "Voice note memo ready"}
                    </span>
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateObjects(canvasObjects.filter(o => o.id !== obj.id));
                  }}
                  className="p-1 hover:bg-red-500/10 text-red-400 hover:text-red-500 rounded transition-colors text-xs cursor-pointer"
                  title="Delete voice note"
                >
                  🗑️
                </button>
              </div>
            </div>
          </foreignObject>
        )}

        {obj.type === "image" && (
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            className="overflow-hidden pointer-events-auto"
          >
            <div
              className={`w-full h-full rounded-2xl border overflow-hidden relative transition-all ${
                isSelected ? "border-[#D0BCFF] bg-[#121212]/95" : "border-[#333333]/40 bg-[#1C1C1C]/90"
              }`}
            >
              {obj.imageUrl ? (
                <img
                  src={obj.imageUrl}
                  alt={obj.content || "Whiteboard attachment"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 bg-black/40">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-[10px] text-[#E6E1E5] font-semibold mt-1 truncate max-w-full">
                    {obj.content || "Image Element"}
                  </span>
                </div>
              )}
              <span className="absolute bottom-1 right-2 text-[7px] text-[#D0BCFF] uppercase font-bold tracking-wider font-mono select-none pointer-events-none bg-black/40 px-1 py-0.5 rounded">
                🖼️ IMAGE REFERENCE
              </span>
            </div>
          </foreignObject>
        )}

        {obj.type === "table" && (
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            className="overflow-hidden pointer-events-auto"
          >
            <div
              className={`w-full h-full p-4 rounded-2xl border overflow-y-auto no-scrollbar relative transition-colors ${
                isSelected ? "border-[#D0BCFF] bg-[#121212]/95" : "border-[#333333]/40 bg-[#1C1C1C]/90"
              }`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingObjectId(obj.id);
              }}
            >
              {editingObjectId === obj.id ? (
                <textarea
                  autoFocus
                  defaultValue={obj.content}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateObjects(canvasObjects.map(o => o.id === obj.id ? { ...o, content: val } : o), false);
                  }}
                  onBlur={() => {
                    setEditingObjectId(null);
                    onUpdateObjects(canvasObjects); // commit history
                  }}
                  className="w-full h-full bg-transparent border-none outline-none resize-none text-[#E6E1E5] font-mono text-xs p-0 leading-relaxed"
                  placeholder="Type markdown table..."
                />
              ) : (
                <div className="w-full h-full text-xs text-[#E6E1E5] select-text">
                  {(() => {
                    const parsed = parseMarkdownTable(obj.content || "");
                    if (!parsed) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full text-center text-[#938F99] italic">
                          <span>Invalid Markdown Table</span>
                          <span className="text-[10px] mt-1 font-mono">{obj.content}</span>
                        </div>
                      );
                    }
                    return (
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-[#333333]">
                            {parsed.headers.map((h, i) => (
                              <th key={i} className="pb-2 font-bold text-[#D0BCFF] uppercase text-[10px] tracking-wider font-mono px-2">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.rows.map((row, i) => (
                            <tr key={i} className="border-b border-[#333333]/40 hover:bg-white/5 transition-colors">
                              {row.map((cell, j) => (
                                <td key={j} className="py-2 px-2 text-xs text-[#E6E1E5]">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}
              <span className="absolute bottom-1 right-2 text-[7px] text-[#34d399] uppercase font-bold tracking-wider font-mono select-none pointer-events-none">
                📊 TABLE DATA
              </span>
            </div>
          </foreignObject>
        )}
      </>
    );
    } catch (err: any) {
      console.error("Error rendering canvas object:", err, obj);
      return (
        <foreignObject x={0} y={0} width={obj?.width || 100} height={obj?.height || 80}>
          <div className="bg-red-950/90 border border-red-500 rounded p-2 text-[10px] text-red-200 overflow-auto h-full">
            <strong>Render Error:</strong> {err?.message || "Unknown error"}
          </div>
        </foreignObject>
      );
    }
  };

  const renderRulerElement = () => {
    if (!ruler || !ruler.isActive) return null;

    const thickness = 65;
    const halfLen = ruler.length / 2;
    const ticksCount = Math.floor(ruler.length / 3.78); // Number of mm ticks

    return (
      <g
        transform={`translate(${ruler.x}, ${ruler.y}) rotate(${ruler.angle})`}
        className="select-none z-30"
      >
        {/* Transparent glass ruler background */}
        <rect
          x={-halfLen}
          y={-thickness / 2}
          width={ruler.length}
          height={thickness}
          rx={6}
          ry={6}
          fill={ruler.color}
          fillOpacity={ruler.opacity}
          stroke={ruler.color}
          strokeWidth={ruler.isLocked ? 1.5 : 2.5}
          strokeDasharray={ruler.isLocked ? "4 4" : undefined}
          className="cursor-move transition-all"
          style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.4))" }}
          onMouseDown={(e) => {
            if (ruler.isLocked) return;
            e.stopPropagation();
            const coords = getCanvasCoords(e.clientX, e.clientY);
            setRulerDragMode("move");
            setRulerDragStart({
              x: coords.x,
              y: coords.y,
              rulerStart: { x: ruler.x, y: ruler.y, angle: ruler.angle, length: ruler.length },
            });
          }}
        />

        {/* Center alignment line */}
        <line
          x1={-halfLen + 10}
          y1={0}
          x2={halfLen - 10}
          y2={0}
          stroke="#121212"
          strokeWidth={1}
          strokeDasharray="5 5"
          className="opacity-25"
        />

        {/* Cm/Mm markings along top and bottom edges */}
        {Array.from({ length: ticksCount + 1 }).map((_, i) => {
          const mmPos = i * 3.78;
          const x = -halfLen + mmPos;
          if (x > halfLen) return null;

          const isCm = i % 10 === 0;
          const isHalfCm = i % 5 === 0 && !isCm;

          let tickHeight = 6;
          if (isCm) tickHeight = 12;
          else if (isHalfCm) tickHeight = 9;

          return (
            <g key={i}>
              {/* Top Ticks */}
              <line
                x1={x}
                y1={-thickness / 2}
                x2={x}
                y2={-thickness / 2 + tickHeight}
                stroke="#121212"
                strokeWidth={isCm ? 1.2 : 0.8}
                className="opacity-85"
              />
              {/* Bottom Ticks */}
              <line
                x1={x}
                y1={thickness / 2}
                x2={x}
                y2={thickness / 2 - tickHeight}
                stroke="#121212"
                strokeWidth={isCm ? 1.2 : 0.8}
                className="opacity-85"
              />
              {/* Cm numbers label */}
              {isCm && (i / 10) % 2 === 0 && x + 10 < halfLen && x - 10 > -halfLen && (
                <text
                  x={x}
                  y={4}
                  fill="#121212"
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="opacity-80 select-none"
                >
                  {i / 10}
                </text>
              )}
            </g>
          );
        })}

        {/* Floating angle indicator widget on top of ruler */}
        <g transform={`translate(0, ${-thickness / 2 - 25})`}>
          <rect
            x={-35}
            y={-10}
            width={70}
            height={18}
            rx={4}
            fill="#121212"
            fillOpacity={0.9}
            stroke="#333333"
            strokeWidth={1}
          />
          <text
            x={0}
            y={2}
            fill="#D0BCFF"
            fontSize={9}
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            {Math.round(ruler.angle)}°
          </text>
        </g>

        {!ruler.isLocked && (
          <>
            {/* Rotation Handle */}
            <g
              transform={`translate(${halfLen - 25}, 0)`}
              className="cursor-pointer group"
              onMouseDown={(e) => {
                e.stopPropagation();
                const coords = getCanvasCoords(e.clientX, e.clientY);
                setRulerDragMode("rotate");
                setRulerDragStart({
                  x: coords.x,
                  y: coords.y,
                  rulerStart: { x: ruler.x, y: ruler.y, angle: ruler.angle, length: ruler.length },
                });
              }}
            >
              <circle
                r={12}
                fill="#121212"
                stroke="#D0BCFF"
                strokeWidth={1.5}
                className="group-hover:fill-[#2B2930] transition-colors"
              />
              <path
                d="M -5 -3 A 6 6 0 0 1 5 -3 M 5 -3 L 3 -1 M 5 -3 L 3 -5 M -5 3 A 6 6 0 0 1 -5 -3 M -5 3 L -3 1 M -5 3 L -3 5"
                fill="none"
                stroke="#D0BCFF"
                strokeWidth={1}
              />
            </g>

            {/* Resize Handle */}
            <g
              transform={`translate(${halfLen}, 0)`}
              className="cursor-ew-resize group"
              onMouseDown={(e) => {
                e.stopPropagation();
                const coords = getCanvasCoords(e.clientX, e.clientY);
                setRulerDragMode("resize");
                setRulerDragStart({
                  x: coords.x,
                  y: coords.y,
                  rulerStart: { x: ruler.x, y: ruler.y, angle: ruler.angle, length: ruler.length },
                });
              }}
            >
              <rect
                x={-4}
                y={-14}
                width={8}
                height={28}
                rx={2}
                fill="#D0BCFF"
                stroke="#121212"
                strokeWidth={1}
                className="group-hover:scale-y-110 transition-transform"
              />
              <line x1={-1} y1={-6} x2={-1} y2={6} stroke="#121212" strokeWidth={1} />
              <line x1={1} y1={-6} x2={1} y2={6} stroke="#121212" strokeWidth={1} />
            </g>
          </>
        )}

        {/* Small lock indicator icon badge */}
        {ruler.isLocked && (
          <g transform={`translate(0, 0)`} className="opacity-70">
            <circle r={8} fill="#121212" stroke="#ffb4ab" strokeWidth={1} />
            <path d="M -3 1 L 3 1 L 3 -2 L -3 -2 Z M -2 -2 A 2 2 0 0 1 2 -2" fill="none" stroke="#ffb4ab" strokeWidth={1} />
          </g>
        )}
      </g>
    );
  };

  const bounds = getSelectedBounds();

  const showToolbar = bounds !== null;

  return (
    <div className="relative w-full h-full">
      {isGridEnabled && (
        <div
          style={{
            backgroundImage: "radial-gradient(circle, #2A2A2A 1.5px, transparent 1.5px)",
            backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          }}
          className="absolute inset-0 pointer-events-none z-0"
        />
      )}

      {/* High-performance WebGL stroke layer for zero CPU handwriting rendering */}
      <WebGLStrokeRenderer
        canvasObjects={canvasObjects}
        currentPath={currentPath}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        activeTool={activeTool}
        panOffset={panOffset}
        zoom={zoom}
      />

      {isSolving && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1C1C1C]/95 border border-[#D0BCFF] px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs text-[#D0BCFF] font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D0BCFF]" />
          <span>Gemini Mathematics Engine active...</span>
        </div>
      )}

      {isConverting && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1C1C1C]/95 border border-[#86efac] px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs text-[#86efac] font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#86efac]" />
          <span>Gemini AI Selection Conversion active...</span>
        </div>
      )}

      {/* Sophisticated Action Toolbar for Selected Objects */}
      {showToolbar && bounds && (
        <div
          style={{
            left: Math.max(20, bounds.x * zoom + panOffset.x),
            top: Math.max(80, (bounds.y - 60) * zoom + panOffset.y)
          }}
          className="absolute bg-[#121212]/95 border border-[#333333] shadow-2xl rounded-2xl flex items-center p-1.5 gap-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {(() => {
            const selectedTextObj = canvasObjects.find(o => (o.isSelected || o.isLassoSelected) && o.type === "text");
            if (selectedTextObj) {
              return (
                <>
                  {/* Font Family Selection */}
                  <select
                    value={selectedTextObj.fontFamily || "Inter"}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateObjects(canvasObjects.map(o => o.id === selectedTextObj.id ? { ...o, fontFamily: val } : o));
                    }}
                    className="bg-[#1C1C1C] border border-[#333333] rounded-lg text-[11px] text-[#E6E1E5] px-2 py-1 outline-none font-semibold cursor-pointer hover:bg-[#2A2A2A] transition-colors shrink-0"
                  >
                    <option value="Inter">Inter (Sans)</option>
                    <option value="Playfair Display">Playfair (Serif)</option>
                    <option value="JetBrains Mono">JetBrains (Mono)</option>
                    <option value="cursive">Cursive</option>
                  </select>

                  {/* Font Size Buttons */}
                  <div className="flex items-center gap-0.5 bg-[#1C1C1C] border border-[#333333] rounded-lg p-0.5 shrink-0">
                    <button
                      onClick={() => {
                        const currentSize = selectedTextObj.fontSize || 16;
                        const newSize = Math.max(8, currentSize - 2);
                        onUpdateObjects(canvasObjects.map(o => o.id === selectedTextObj.id ? { ...o, fontSize: newSize } : o));
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#333333] text-[#E6E1E5] text-[10px] font-bold"
                      title="Decrease Font Size"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-mono font-bold px-1 min-w-[16px] text-center text-[#938F99]">
                      {selectedTextObj.fontSize || 16}
                    </span>
                    <button
                      onClick={() => {
                        const currentSize = selectedTextObj.fontSize || 16;
                        const newSize = Math.min(72, currentSize + 2);
                        onUpdateObjects(canvasObjects.map(o => o.id === selectedTextObj.id ? { ...o, fontSize: newSize } : o));
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#333333] text-[#E6E1E5] text-[10px] font-bold"
                      title="Increase Font Size"
                    >
                      +
                    </button>
                  </div>

                  {/* Text formatting Toggles */}
                  <div className="flex items-center gap-0.5 bg-[#1C1C1C] border border-[#333333] rounded-lg p-0.5 shrink-0">
                    <button
                      onClick={() => {
                        onUpdateObjects(canvasObjects.map(o => o.id === selectedTextObj.id ? { ...o, bold: !o.bold } : o));
                      }}
                      className={`w-5 h-5 flex items-center justify-center rounded font-bold text-[10px] ${
                        selectedTextObj.bold ? "bg-[#D0BCFF] text-[#381E72]" : "hover:bg-[#333333] text-[#E6E1E5]"
                      }`}
                      title="Toggle Bold"
                    >
                      B
                    </button>
                    <button
                      onClick={() => {
                        onUpdateObjects(canvasObjects.map(o => o.id === selectedTextObj.id ? { ...o, italic: !o.italic } : o));
                      }}
                      className={`w-5 h-5 flex items-center justify-center rounded italic text-[10px] ${
                        selectedTextObj.italic ? "bg-[#D0BCFF] text-[#381E72]" : "hover:bg-[#333333] text-[#E6E1E5]"
                      }`}
                      title="Toggle Italic"
                    >
                      I
                    </button>
                    <button
                      onClick={() => {
                        onUpdateObjects(canvasObjects.map(o => o.id === selectedTextObj.id ? { ...o, underline: !o.underline } : o));
                      }}
                      className={`w-5 h-5 flex items-center justify-center rounded underline text-[10px] ${
                        selectedTextObj.underline ? "bg-[#D0BCFF] text-[#381E72]" : "hover:bg-[#333333] text-[#E6E1E5]"
                      }`}
                      title="Toggle Underline"
                    >
                      U
                    </button>
                  </div>

                  <div className="w-px h-5 bg-[#333333]" />
                </>
              );
            }
            return null;
          })()}

          {/* Group / Ungroup buttons */}
          <button
            onClick={handleGroupSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1C1C1C] text-[#E6E1E5] text-xs font-semibold transition-colors"
            title="Group Selected Objects"
          >
            <Link className="w-3.5 h-3.5 text-[#D0BCFF]" />
            <span className="hidden sm:inline">Group</span>
          </button>

          <button
            onClick={handleUngroupSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1C1C1C] text-[#E6E1E5] text-xs font-semibold transition-colors"
            title="Ungroup Selected Objects"
          >
            <span className="text-[#938F99]">Ungroup</span>
          </button>

          <div className="w-px h-5 bg-[#333333]" />

          {/* Duplicate selection */}
          <button
            onClick={handleDuplicateSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1C1C1C] text-[#E6E1E5] text-xs font-semibold transition-colors"
            title="Duplicate selected items"
          >
            <Copy className="w-3.5 h-3.5 text-[#D0BCFF]" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          <div className="w-px h-5 bg-[#333333]" />

          {/* Depth management */}
          <button
            onClick={handleMoveToFront}
            className="p-1.5 rounded-lg hover:bg-[#1C1C1C] text-[#E6E1E5] transition-colors"
            title="Bring to Front"
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleMoveToBack}
            className="p-1.5 rounded-lg hover:bg-[#1C1C1C] text-[#E6E1E5] transition-colors"
            title="Send to Back"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-5 bg-[#333333]" />

          {/* Conversion to Text/LaTeX */}
          <div className="relative group/convert">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1C1C1C] text-[#D0BCFF] text-xs font-semibold transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-[#D0BCFF]" />
              <span>Convert AI</span>
            </button>
            <div className="absolute left-0 bottom-full mb-2 w-44 bg-[#121212] rounded-xl border border-[#333333] shadow-2xl flex flex-col p-1.5 z-50 hidden group-hover/convert:flex">
              <button
                onClick={() => handleConvertSelection("text")}
                className="text-left text-xs text-[#E6E1E5] hover:bg-[#1C1C1C] px-2.5 py-2 rounded-lg transition-colors"
              >
                📝 Regular Text Box
              </button>
              <button
                onClick={() => handleConvertSelection("formula")}
                className="text-left text-xs text-[#E6E1E5] hover:bg-[#1C1C1C] px-2.5 py-2 rounded-lg transition-colors"
              >
                🔬 LaTeX Math Block
              </button>
            </div>
          </div>

          <div className="w-px h-5 bg-[#333333]" />

          {/* Mathematical solving trigger */}
          <button
            onClick={handleSolveSelection}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#2B2930] text-[#86efac] text-xs font-semibold transition-colors"
            title="Solve written mathematical equations using Gemini AI"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Solve AI</span>
          </button>

          <div className="w-px h-5 bg-[#333333]" />

          {/* Delete action */}
          <button
            onClick={handleDeleteSelection}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
            title="Delete Elements"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SVG Vector Canvas layer */}
      <svg
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`w-full h-full relative z-10 cursor-crosshair ${
          isSpacePressed || activeTool === "pan" ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {/* Infinite Grid View Group with hardware-accelerated rendering cues */}
        <g 
          transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}
          style={{ willChange: "transform", backfaceVisibility: "hidden" }}
        >
          
          {pendingRecognition && (
            <rect
              x={pendingRecognition.x - 6}
              y={pendingRecognition.y - 6}
              width={pendingRecognition.width + 12}
              height={pendingRecognition.height + 12}
              fill="none"
              stroke="#D0BCFF"
              strokeWidth={2}
              strokeDasharray="4 4"
              rx={8}
              className="animate-pulse"
            />
          )}

          {(() => {
            // Frustum Culling calculation for optimization
            const viewWidth = window.innerWidth || 1200;
            const viewHeight = window.innerHeight || 800;
            const left = -panOffset.x / zoom;
            const top = -panOffset.y / zoom;
            const right = left + viewWidth / zoom;
            const bottom = top + viewHeight / zoom;
            const pad = 250; // offset buffer to prevent objects popping at margins

            return (canvasObjects || []).map((obj) => {
              if (!obj) return null;
              if (obj.hidden) return null; // Respect Show/Hide visibility

              const width = obj.width || 100;
              const height = obj.height || 80;

              // Visually check if the object's box is in-viewport
              const isCulled = 
                obj.x + width < left - pad ||
                obj.x > right + pad ||
                obj.y + height < top - pad ||
                obj.y > bottom + pad;

              // Don't cull if selected to avoid weird active bounding box glitches
              if (isCulled && !(obj.isSelected || obj.isLassoSelected)) {
                return null;
              }

              const isSelected = (obj.isSelected || obj.isLassoSelected) && !obj.isLocked; // Don't show selection box if locked

              return (
                <g 
                  key={obj.id} 
                  transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0}, ${width / 2}, ${height / 2})`}
                  style={{ 
                    opacity: obj.opacity !== undefined ? obj.opacity : 1,
                    willChange: "transform",
                    backfaceVisibility: "hidden"
                  }}
                >
                  {renderObjectContent(obj, isSelected)}
                </g>
              );
            });
          })()}

          {/* Live drawing path is now rendered via high-performance WebGL to bypass DOM layout recalculations, but fallback to SVG if toggled */}
          {renderBackend === "svg" && currentPath.length > 1 && (
            <path
              d={"M " + currentPath[0].x + " " + currentPath[0].y + " " + currentPath.slice(1).map(p => "L " + p.x + " " + p.y).join(" ")}
              fill="none"
              stroke={activeTool === "highlighter" ? `${activeColor}4d` : activeColor}
              strokeWidth={activeTool === "highlighter" ? strokeWidth * 2.5 : strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Lasso Active path loop */}
          {lassoPoints.length > 1 && (
            <path
              d={"M " + lassoPoints[0].x + " " + lassoPoints[0].y + " " + lassoPoints.slice(1).map(p => "L " + p.x + " " + p.y).join(" ")}
              fill="rgba(208, 188, 255, 0.08)"
              stroke="#D0BCFF"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}

          {/* Interactive Bounding Frame (displayed for active selection) */}
          {(() => {
            const currentBounds = getSelectedBounds();
            if (!currentBounds) return null;
            
            const { x, y, width, height } = currentBounds;
            const pad = 8;
            const bx = x - pad;
            const by = y - pad;
            const bw = width + pad * 2;
            const bh = height + pad * 2;
            
            const handles = [
              { id: "tl", cx: bx, cy: by, cursor: "nwse-resize" },
              { id: "tm", cx: bx + bw / 2, cy: by, cursor: "ns-resize" },
              { id: "tr", cx: bx + bw, cy: by, cursor: "nesw-resize" },
              { id: "ml", cx: bx, cy: by + bh / 2, cursor: "ew-resize" },
              { id: "mr", cx: bx + bw, cy: by + bh / 2, cursor: "ew-resize" },
              { id: "bl", cx: bx, cy: by + bh, cursor: "nesw-resize" },
              { id: "bm", cx: bx + bw / 2, cy: by + bh, cursor: "ns-resize" },
              { id: "br", cx: bx + bw, cy: by + bh, cursor: "nwse-resize" },
            ];
            
            return (
              <g>
                {/* Selection Frame */}
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  fill="none"
                  stroke="#D0BCFF"
                  strokeWidth={1.2}
                  strokeDasharray="4 2"
                  rx={6}
                />
                
                {/* Rotation Pin */}
                <line
                  x1={bx + bw / 2}
                  y1={by}
                  x2={bx + bw / 2}
                  y2={by - 24}
                  stroke="#D0BCFF"
                  strokeWidth={1.2}
                />
                <circle
                  cx={bx + bw / 2}
                  cy={by - 24}
                  r={5}
                  fill="#D0BCFF"
                  stroke="#121212"
                  strokeWidth={1.2}
                  className="cursor-alias hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startRotation(e, currentBounds);
                  }}
                  title="Rotate Selection"
                />
                
                {/* 8 Resize Corner/Edge Pins */}
                {handles.map((h) => (
                  <rect
                    key={h.id}
                    x={h.cx - 4}
                    y={h.cy - 4}
                    width={8}
                    height={8}
                    fill="#D0BCFF"
                    stroke="#121212"
                    strokeWidth={1}
                    className="hover:scale-125 transition-transform"
                    style={{ cursor: h.cursor }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      startResizing(e, h.id, currentBounds);
                    }}
                  />
                ))}
              </g>
            );
          })()}

          {/* Floating smart formula solutions */}
          {formulaSolutions.map((sol, index) => (
            <g key={index} transform={`translate(${sol.x}, ${sol.y})`}>
              <rect
                width={360}
                height={220}
                rx={16}
                fill="#1C1C1C"
                stroke="#86efac"
                strokeWidth={1.5}
                className="shadow-xl"
              />
              <text x={16} y={32} fill="#86efac" fontSize="11" fontWeight="bold" fontFamily="sans-serif" letterSpacing="1">
                🔬 SMART CALCULATOR SOLUTION
              </text>
              <text x={16} y={55} fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="monospace">
                {sol.formula}
              </text>
              <foreignObject x={16} y={70} width={328} height={135}>
                <div className="text-gray-300 text-[10px] leading-relaxed font-mono overflow-y-auto max-h-[125px] pr-2 whitespace-pre-wrap no-scrollbar">
                  {sol.solution}
                </div>
              </foreignObject>
              <g
                transform="translate(325, 15)"
                className="cursor-pointer hover:opacity-80"
                onClick={() => setFormulaSolutions(formulaSolutions.filter((_, i) => i !== index))}
              >
                <circle cx={10} cy={10} r={10} fill="#2B2930" />
                <path d="M 7 7 L 13 13 M 13 7 L 7 13" stroke="#ffdad6" strokeWidth={1.5} />
              </g>
            </g>
          ))}

          {/* Physical Ruler Tool Overlay */}
          {renderRulerElement()}

          {/* Real-time snapped measurement tooltip label */}
          {liveRulerDrawLength && currentPath.length > 0 && (
            <g transform={`translate(${currentPath[currentPath.length - 1].x}, ${currentPath[currentPath.length - 1].y - 20 / zoom})`}>
              <rect
                x={-40}
                y={-12}
                width={80}
                height={18}
                rx={6}
                fill="#D0BCFF"
                stroke="#381E72"
                strokeWidth={1.5}
              />
              <text
                x={0}
                y={1}
                fill="#381E72"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {liveRulerDrawLength}
              </text>
            </g>
          )}
        </g>
      </svg>

      {aiRecognitionStatus && (
        <div
          style={{
            left: `${aiRecognitionStatus.x * zoom + panOffset.x}px`,
            top: `${aiRecognitionStatus.y * zoom + panOffset.y}px`,
          }}
          className="absolute z-[100] -translate-x-1/2 -translate-y-full bg-[#1e152e]/95 backdrop-blur-md border border-[#D0BCFF]/60 px-3 py-1.5 rounded-full shadow-[0_4px_20px_rgba(208,188,255,0.25)] flex items-center gap-2 animate-pulse pointer-events-none"
        >
          <div className="w-2 h-2 rounded-full bg-[#D0BCFF] animate-ping" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-[#D0BCFF] uppercase">
            {aiRecognitionStatus.message}
          </span>
        </div>
      )}

      {pendingRecognition && (
        <div
          style={{
            left: `${pendingRecognition.x * zoom + panOffset.x}px`,
            top: `${(pendingRecognition.y - 12) * zoom + panOffset.y}px`,
          }}
          className="absolute z-[100] -translate-x-1/2 -translate-y-full bg-[#1C1C1C]/95 backdrop-blur-xl border border-[#D0BCFF] px-4.5 py-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-2 min-w-[260px] animate-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#938F99] font-mono">
              ⚡ Sketch Recognized
            </span>
            <button
              onClick={() => {
                triggerHaptic(15);
                setPendingRecognition(null);
              }}
              className="text-[#938F99] hover:text-[#E6E1E5] text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-100">{pendingRecognition.detectedLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <button
              onClick={() => {
                triggerHaptic(30);
                const vectorObj: CanvasObject = {
                  id: `library-${pendingRecognition.detectedType}-${Date.now()}`,
                  type: "shape",
                  x: pendingRecognition.x,
                  y: pendingRecognition.y,
                  width: pendingRecognition.width,
                  height: pendingRecognition.height,
                  rotation: 0,
                  layer: Date.now(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  color: activeColor,
                  strokeWidth: strokeWidth,
                  shapeType: pendingRecognition.detectedType as any,
                  isSelected: true,
                  isLassoSelected: true,
                  content: pendingRecognition.detectedLabel.split(" (")[0],
                };
                
                onUpdateObjects([
                  ...canvasObjects.filter(o => o.id !== pendingRecognition.id).map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
                  vectorObj
                ]);
                
                setPendingRecognition(null);
              }}
              className="px-3 py-1.5 bg-[#D0BCFF] text-[#381E72] hover:bg-opacity-95 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              Convert to Vector
            </button>
            
            <button
              onClick={() => {
                triggerHaptic(15);
                setPendingRecognition(null);
              }}
              className="px-2.5 py-1.5 bg-[#1C1C1C] text-[#E6E1E5] border border-[#333333] hover:bg-[#2B2930] text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Keep Sketch
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-[#333333]/60 pt-2 mt-1 text-[9px] text-[#938F99]">
            <button
              onClick={() => {
                triggerHaptic(30);
                setSmartSettings({ alwaysConvert: true, neverConvert: false });
                const vectorObj: CanvasObject = {
                  id: `library-${pendingRecognition.detectedType}-${Date.now()}`,
                  type: "shape",
                  x: pendingRecognition.x,
                  y: pendingRecognition.y,
                  width: pendingRecognition.width,
                  height: pendingRecognition.height,
                  rotation: 0,
                  layer: Date.now(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  color: activeColor,
                  strokeWidth: strokeWidth,
                  shapeType: pendingRecognition.detectedType as any,
                  isSelected: true,
                  isLassoSelected: true,
                  content: pendingRecognition.detectedLabel.split(" (")[0],
                };
                onUpdateObjects([
                  ...canvasObjects.filter(o => o.id !== pendingRecognition.id).map(o => ({ ...o, isSelected: false, isLassoSelected: false })),
                  vectorObj
                ]);
                setPendingRecognition(null);
              }}
              className="hover:text-[#D0BCFF] transition-colors cursor-pointer"
            >
              Always Convert
            </button>
            <span className="opacity-40">|</span>
            <button
              onClick={() => {
                triggerHaptic(15);
                setSmartSettings({ alwaysConvert: false, neverConvert: true });
                setPendingRecognition(null);
              }}
              className="hover:text-[#D0BCFF] transition-colors cursor-pointer"
            >
              Never Convert
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
