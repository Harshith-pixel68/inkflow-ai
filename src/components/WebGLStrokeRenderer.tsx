import React, { useEffect, useRef } from "react";
import { CanvasObject } from "../types";

interface WebGLStrokeRendererProps {
  canvasObjects: CanvasObject[];
  currentPath: { x: number; y: number }[];
  activeColor: string;
  strokeWidth: number;
  activeTool: string;
  panOffset: { x: number; y: number };
  zoom: number;
  renderBackend?: "webgl" | "svg";
}

// Global parsed color cache to eliminate heavy string split/regex parsing inside frame loop
const PARSED_COLOR_CACHE = new Map<string, [number, number, number, number]>();

function parseColor(colorStr: string): [number, number, number, number] {
  if (!colorStr) return [1.0, 1.0, 1.0, 1.0];
  
  const trimmed = colorStr.trim();
  const cached = PARSED_COLOR_CACHE.get(trimmed);
  if (cached) return cached;

  let result: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      result = [r, g, b, 1.0];
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      result = [r, g, b, 1.0];
    } else if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      result = [r, g, b, a];
    }
  } else if (trimmed.startsWith("rgb")) {
    const match = trimmed.match(/\d+(\.\d+)?/g);
    if (match) {
      const r = parseFloat(match[0]) / 255;
      const g = parseFloat(match[1]) / 255;
      const b = parseFloat(match[2]) / 255;
      const a = match[3] ? parseFloat(match[3]) : 1.0;
      result = [r, g, b, a];
    }
  }

  PARSED_COLOR_CACHE.set(trimmed, result);
  return result;
}

// Generate triangulation coordinates for high-performance strokes with rounded joint caps
function generateStrokeVertices(
  points: { x: number; y: number }[],
  color: string,
  width: number,
  objX: number = 0,
  objY: number = 0,
  rotation: number = 0,
  objW: number = 100,
  objH: number = 80
): Float32Array {
  if (points.length < 2) return new Float32Array(0);

  const [r, g, b, a] = parseColor(color);

  const hasRotation = rotation !== 0;
  const rad = -(rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const cx = objW / 2;
  const cy = objH / 2;

  const transformPoint = (p: { x: number; y: number }) => {
    if (!hasRotation) {
      return { x: p.x + objX, y: p.y + objY };
    }
    const dx = p.x - cx;
    const dy = p.y - cy;
    const rx = dx * cosR - dy * sinR + cx + objX;
    const ry = dx * sinR + dy * cosR + cy + objY;
    return { x: rx, y: ry };
  };

  const transformedPoints = points.map(transformPoint);
  const halfW = width / 2;

  // Exact polygon sizes:
  // For each point, we draw a solid 8-side circular joint cap to simulate beautiful pressure-sensitive round brush tips:
  // 8 triangles per cap, each triangle has 3 vertices, each vertex has 6 floats (x, y, r, g, b, a) = 144 floats per point.
  // For each of the (points.length - 1) line segments, we draw a rectangle quad (2 triangles = 6 vertices) = 36 floats per segment.
  const numCapsTriangles = 8;
  const verticesPerCap = numCapsTriangles * 3; 
  const verticesPerSegment = 6;
  const totalVertices = points.length * verticesPerCap + (points.length - 1) * verticesPerSegment;
  const buffer = new Float32Array(totalVertices * 6);
  let offset = 0;

  // 1. Draw rounded joints (caps)
  for (let i = 0; i < transformedPoints.length; i++) {
    const pt = transformedPoints[i];
    for (let j = 0; j < numCapsTriangles; j++) {
      const theta1 = (j / numCapsTriangles) * Math.PI * 2;
      const theta2 = ((j + 1) / numCapsTriangles) * Math.PI * 2;
      
      const x1 = pt.x + Math.cos(theta1) * halfW;
      const y1 = pt.y + Math.sin(theta1) * halfW;
      const x2 = pt.x + Math.cos(theta2) * halfW;
      const y2 = pt.y + Math.sin(theta2) * halfW;

      // Triangle Vertex 1 (Center)
      buffer[offset++] = pt.x;
      buffer[offset++] = pt.y;
      buffer[offset++] = r;
      buffer[offset++] = g;
      buffer[offset++] = b;
      buffer[offset++] = a;

      // Triangle Vertex 2 (Edge Point 1)
      buffer[offset++] = x1;
      buffer[offset++] = y1;
      buffer[offset++] = r;
      buffer[offset++] = g;
      buffer[offset++] = b;
      buffer[offset++] = a;

      // Triangle Vertex 3 (Edge Point 2)
      buffer[offset++] = x2;
      buffer[offset++] = y2;
      buffer[offset++] = r;
      buffer[offset++] = g;
      buffer[offset++] = b;
      buffer[offset++] = a;
    }
  }

  // 2. Draw connecting segment rectangles (Quads)
  for (let i = 0; i < transformedPoints.length - 1; i++) {
    const p1 = transformedPoints[i];
    const p2 = transformedPoints[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const nx = dx / len;
    const ny = dy / len;
    const px = -ny;
    const py = nx;

    const vx0 = p1.x + px * halfW;
    const vy0 = p1.y + py * halfW;
    
    const vx1 = p1.x - px * halfW;
    const vy1 = p1.y - py * halfW;

    const vx2 = p2.x + px * halfW;
    const vy2 = p2.y + py * halfW;

    const vx3 = p2.x - px * halfW;
    const vy3 = p2.y - py * halfW;

    // Triangle 1
    buffer[offset++] = vx0;
    buffer[offset++] = vy0;
    buffer[offset++] = r;
    buffer[offset++] = g;
    buffer[offset++] = b;
    buffer[offset++] = a;

    buffer[offset++] = vx1;
    buffer[offset++] = vy1;
    buffer[offset++] = r;
    buffer[offset++] = g;
    buffer[offset++] = b;
    buffer[offset++] = a;

    buffer[offset++] = vx2;
    buffer[offset++] = vy2;
    buffer[offset++] = r;
    buffer[offset++] = g;
    buffer[offset++] = b;
    buffer[offset++] = a;

    // Triangle 2
    buffer[offset++] = vx1;
    buffer[offset++] = vy1;
    buffer[offset++] = r;
    buffer[offset++] = g;
    buffer[offset++] = b;
    buffer[offset++] = a;

    buffer[offset++] = vx3;
    buffer[offset++] = vy3;
    buffer[offset++] = r;
    buffer[offset++] = g;
    buffer[offset++] = b;
    buffer[offset++] = a;

    buffer[offset++] = vx2;
    buffer[offset++] = vy2;
    buffer[offset++] = r;
    buffer[offset++] = g;
    buffer[offset++] = b;
    buffer[offset++] = a;
  }

  return offset === buffer.length ? buffer : buffer.subarray(0, offset);
}

// Fast hashing function to fingerprint a CanvasObject based on geometry and styling properties.
// Avoids garbage collection pressure of constructing string keys inside the animation frame loop.
function calculateObjectHash(obj: CanvasObject): number {
  let h = 2166136261 >>> 0;
  const mix = (val: number) => {
    h ^= val;
    h = Math.imul(h, 16777619);
  };

  mix(obj.points ? obj.points.length : 0);
  mix(Math.floor((obj.x || 0) * 100));
  mix(Math.floor((obj.y || 0) * 100));
  mix(Math.floor((obj.rotation || 0) * 100));
  mix(Math.floor((obj.width || 100) * 100));
  mix(Math.floor((obj.height || 80) * 100));
  mix(Math.floor((obj.strokeWidth || 3) * 100));

  const color = obj.color || "";
  for (let i = 0; i < color.length; i++) {
    h ^= color.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  if (obj.points && obj.points.length > 0) {
    const first = obj.points[0];
    const last = obj.points[obj.points.length - 1];
    mix(Math.floor(first.x * 100));
    mix(Math.floor(first.y * 100));
    mix(Math.floor(last.x * 100));
    mix(Math.floor(last.y * 100));
  }

  return h >>> 0;
}

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec4 a_color;

  uniform vec2 u_pan;
  uniform float u_zoom;
  uniform vec2 u_resolution;

  varying vec4 v_color;

  void main() {
    // Transform coordinates inside high-speed vertex shader to offload CPU rendering steps
    vec2 viewport_pos = a_position * u_zoom + u_pan;
    vec2 clip_space = (viewport_pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip_space.x, -clip_space.y, 0.0, 1.0);
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_color;

  void main() {
    gl_FragColor = v_color;
  }
`;

export const WebGLStrokeRenderer: React.FC<WebGLStrokeRendererProps> = ({
  canvasObjects,
  currentPath,
  activeColor,
  strokeWidth,
  activeTool,
  panOffset,
  zoom,
  renderBackend = "webgl"
}) => {
  if (renderBackend === "svg") {
    return null;
  }
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const staticBufferRef = useRef<WebGLBuffer | null>(null);
  const activeBufferRef = useRef<WebGLBuffer | null>(null);

  // Zero-allocation identity cache for rendering static canvas objects
  const identityCacheRef = useRef<WeakMap<CanvasObject, Float32Array>>(new WeakMap());

  // Secondary property hash cache mapped by object ID to capture state changes
  const propertyHashCacheRef = useRef<Map<string, { hash: number; buffer: Float32Array }>>(new Map());

  // Reuse a single giant buffer to completely eliminate JS engine GC allocations
  const globalStaticFloatBufferRef = useRef<Float32Array | null>(null);

  // Track static rendering details for dynamic batching
  const lastStaticObjectsCountRef = useRef<number>(0);
  const lastStaticHashesRef = useRef<number[]>([]);
  const lastStaticIdsRef = useRef<string[]>([]);
  const staticVertexCountRef = useRef<number>(0);

  // Initialize WebGL pipeline shaders and blending rules with static & dynamic buffer allocations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.warn("WebGL not supported, falling back to standard overlay rendering");
      return;
    }
    glRef.current = gl;

    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
    const fs = compileShader(FRAGMENT_SHADER_SOURCE, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("WebGL program link failed:", gl.getProgramInfoLog(program));
      return;
    }
    programRef.current = program;

    const staticBuffer = gl.createBuffer();
    staticBufferRef.current = staticBuffer;

    const activeBuffer = gl.createBuffer();
    activeBufferRef.current = activeBuffer;

    // Enable pre-multiplied smooth alpha blending for crisp sub-pixel strokes
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return () => {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (program) gl.deleteProgram(program);
      if (staticBuffer) gl.deleteBuffer(staticBuffer);
      if (activeBuffer) gl.deleteBuffer(activeBuffer);
    };
  }, []);

  // Update canvas bounds to fill parent notebook container
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;

      const gl = glRef.current;
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Frame Render Trigger
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const staticBuffer = staticBufferRef.current;
    const activeBuffer = activeBufferRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !staticBuffer || !activeBuffer || !canvas) return;

    // 1. Check if static objects changed
    let isStaticDirty = false;
    let staticCount = 0;
    const currentStaticObjects: CanvasObject[] = [];
    const currentStaticHashes: number[] = [];
    const currentStaticIds: string[] = [];

    for (let i = 0; i < canvasObjects.length; i++) {
      const obj = canvasObjects[i];
      if (obj.type === "handwriting" && obj.points && !obj.hidden) {
        staticCount++;
        currentStaticObjects.push(obj);
        
        let cached = identityCacheRef.current.get(obj);
        let currentHash = 0;
        if (!cached) {
          currentHash = calculateObjectHash(obj);
        } else {
          const cachedEntry = propertyHashCacheRef.current.get(obj.id);
          currentHash = cachedEntry ? cachedEntry.hash : calculateObjectHash(obj);
        }
        currentStaticHashes.push(currentHash);
        currentStaticIds.push(obj.id);
      }
    }

    if (staticCount !== lastStaticObjectsCountRef.current) {
      isStaticDirty = true;
    } else {
      for (let i = 0; i < staticCount; i++) {
        if (
          lastStaticIdsRef.current[i] !== currentStaticIds[i] ||
          lastStaticHashesRef.current[i] !== currentStaticHashes[i]
        ) {
          isStaticDirty = true;
          break;
        }
      }
    }

    // 2. If static batch is dirty, rebuild its Float32Array and upload to the GPU
    if (isStaticDirty) {
      const staticRenderList: Float32Array[] = [];
      let totalStaticFloats = 0;

      for (let i = 0; i < currentStaticObjects.length; i++) {
        const obj = currentStaticObjects[i];
        let cached = identityCacheRef.current.get(obj);
        const currentHash = currentStaticHashes[i];

        if (!cached) {
          const cachedEntry = propertyHashCacheRef.current.get(obj.id);
          if (cachedEntry && cachedEntry.hash === currentHash) {
            cached = cachedEntry.buffer;
            identityCacheRef.current.set(obj, cached);
          } else {
            cached = generateStrokeVertices(
              obj.points!,
              obj.color || "#FFFFFF",
              obj.strokeWidth || 3,
              obj.x,
              obj.y,
              obj.rotation || 0,
              obj.width || 100,
              obj.height || 80
            );
            identityCacheRef.current.set(obj, cached);
            propertyHashCacheRef.current.set(obj.id, { hash: currentHash, buffer: cached });
          }
        }

        if (cached && cached.length > 0) {
          staticRenderList.push(cached);
          totalStaticFloats += cached.length;
        }
      }

      staticVertexCountRef.current = totalStaticFloats / 6;

      if (totalStaticFloats > 0) {
        if (!globalStaticFloatBufferRef.current || globalStaticFloatBufferRef.current.length < totalStaticFloats) {
          globalStaticFloatBufferRef.current = new Float32Array(Math.ceil(totalStaticFloats * 1.3));
        }
        const finalStaticBuffer = globalStaticFloatBufferRef.current;
        let offset = 0;
        for (let i = 0; i < staticRenderList.length; i++) {
          finalStaticBuffer.set(staticRenderList[i], offset);
          offset += staticRenderList[i].length;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, finalStaticBuffer.subarray(0, totalStaticFloats), gl.STATIC_DRAW);
      } else {
        staticVertexCountRef.current = 0;
      }

      // Update refs to reflect current static state
      lastStaticObjectsCountRef.current = staticCount;
      lastStaticHashesRef.current = currentStaticHashes;
      lastStaticIdsRef.current = currentStaticIds;
    }

    // 3. Render active high-frequency stroke path if drawing
    let activeVertexCount = 0;
    if (currentPath && currentPath.length >= 2) {
      const isHighlighter = activeTool === "highlighter";
      const pathColor = isHighlighter ? `${activeColor}4d` : activeColor;
      const pathWidth = isHighlighter ? strokeWidth * 2.5 : strokeWidth;
      const activeStrokeBuffer = generateStrokeVertices(currentPath, pathColor, pathWidth);
      
      activeVertexCount = activeStrokeBuffer.length / 6;
      if (activeVertexCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, activeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, activeStrokeBuffer, gl.DYNAMIC_DRAW);
      }
    }

    // 4. Begin actual screen drawing commands
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (staticVertexCountRef.current === 0 && activeVertexCount === 0) return;

    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const colorLoc = gl.getAttribLocation(program, "a_color");
    const panLoc = gl.getUniformLocation(program, "u_pan");
    const zoomLoc = gl.getUniformLocation(program, "u_zoom");
    const resLoc = gl.getUniformLocation(program, "u_resolution");

    gl.uniform2f(panLoc, panOffset.x, panOffset.y);
    gl.uniform1f(zoomLoc, zoom);
    gl.uniform2f(resLoc, canvas.width, canvas.height);

    // Render Static Batch (if any)
    if (staticVertexCountRef.current > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
      
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 24, 0);

      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 24, 8);

      gl.drawArrays(gl.TRIANGLES, 0, staticVertexCountRef.current);
    }

    // Render Active Path (if any)
    if (activeVertexCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, activeBuffer);

      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 24, 0);

      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 24, 8);

      gl.drawArrays(gl.TRIANGLES, 0, activeVertexCount);
    }

    // Garbage Collection of property hashes
    if (Math.random() < 0.005) {
      const activeIds = new Set(canvasObjects.map(o => o.id));
      for (const id of propertyHashCacheRef.current.keys()) {
        if (!activeIds.has(id)) {
          propertyHashCacheRef.current.delete(id);
        }
      }
    }
  }, [canvasObjects, currentPath, activeColor, strokeWidth, activeTool, panOffset, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-5 w-full h-full"
      style={{ mixBlendMode: "normal" }}
    />
  );
};
