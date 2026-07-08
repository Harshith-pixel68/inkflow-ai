import React from "react";
import { CanvasObject } from "../types";

// Base GeometryObject class
export abstract class GeometryObject {
  id: string;
  type: string;
  shapeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  strokeWidth: number;
  isLocked?: boolean;
  hidden?: boolean;
  opacity?: number;
  rawObject: CanvasObject;

  constructor(obj: CanvasObject) {
    this.id = obj.id;
    this.type = obj.type;
    this.shapeType = obj.shapeType || "";
    this.x = obj.x;
    this.y = obj.y;
    this.width = obj.width;
    this.height = obj.height;
    this.rotation = obj.rotation || 0;
    this.color = obj.color || "#D0BCFF";
    this.strokeWidth = obj.strokeWidth || 3;
    this.isLocked = obj.isLocked || false;
    this.hidden = obj.hidden || false;
    this.opacity = obj.opacity ?? 1;
    this.rawObject = obj;
  }

  abstract render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode;
}

// 1. SmartRulerObject
export class SmartRulerObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    const tickColor = this.color;
    const ticks: React.ReactNode[] = [];
    
    // 1 centimeter is roughly 37.8 pixels on typical screens.
    // Let's draw centimeter ticks and millimeter ticks.
    const pxPerMm = 3.78;
    const totalMm = Math.floor(this.width / pxPerMm);

    for (let mm = 0; mm <= totalMm; mm++) {
      const pos = mm * pxPerMm;
      let tickHeight = 6;
      let showLabel = false;

      if (mm % 10 === 0) {
        tickHeight = 16;
        showLabel = true;
      } else if (mm % 5 === 0) {
        tickHeight = 10;
      }

      // Top ticks
      ticks.push(
        <line
          key={`t-tick-${mm}`}
          x1={pos}
          y1={0}
          x2={pos}
          y2={tickHeight}
          stroke={tickColor}
          strokeWidth={mm % 10 === 0 ? 1.5 : 1}
          opacity={0.7}
        />
      );

      // Bottom ticks
      ticks.push(
        <line
          key={`b-tick-${mm}`}
          x1={pos}
          y1={this.height}
          x2={pos}
          y2={this.height - tickHeight}
          stroke={tickColor}
          strokeWidth={mm % 10 === 0 ? 1.5 : 1}
          opacity={0.7}
        />
      );

      if (showLabel && pos < this.width - 15) {
        ticks.push(
          <text
            key={`text-${mm}`}
            x={pos}
            y={28}
            fill={tickColor}
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
            fontWeight="bold"
            opacity={0.9}
          >
            {mm / 10}
          </text>
        );
      }
    }

    const currentOpacity = this.opacity ?? 1;

    return (
      <g style={{ opacity: currentOpacity }}>
        {/* Transparent glass ruler body */}
        <rect
          x={0}
          y={0}
          width={this.width}
          height={this.height}
          fill="#1C1C1C"
          fillOpacity={0.65}
          stroke={this.color}
          strokeWidth={this.isLocked ? 1.5 : 2.5}
          strokeDasharray={this.isLocked ? "4 4" : undefined}
          rx={6}
          className="backdrop-blur-md"
        />

        {/* Center line */}
        <line
          x1={10}
          y1={this.height / 2}
          x2={this.width - 10}
          y2={this.height / 2}
          stroke={this.color}
          strokeWidth={1}
          strokeDasharray="5 5"
          opacity={0.3}
        />

        {/* Ticks and Metric labels */}
        {ticks}

        {/* Info overlay inside Ruler */}
        <g transform={`translate(${this.width - 80}, ${this.height / 2 + 4})`}>
          <rect
            x={-6}
            y={-14}
            width={72}
            height={20}
            fill="#121212"
            fillOpacity={0.8}
            rx={4}
            stroke="#333333"
            strokeWidth={1}
          />
          <text
            x={30}
            y={0}
            textAnchor="middle"
            fill="#E6E1E5"
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
          >
            {Math.round(this.rotation)}° | RULER
          </text>
        </g>

        {/* Quick controls on hover/selection */}
        {isSelected && !this.isLocked && (
          <g transform="translate(10, 18)" className="pointer-events-auto">
            {/* Lock button */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ isLocked: true });
              }}
              className="cursor-pointer hover:opacity-80"
            >
              <rect x={0} y={0} width={38} height={16} fill="#333" rx={3} />
              <text x={19} y={11} fill="#fff" fontSize={8} textAnchor="middle" fontFamily="sans-serif">🔒 Lock</text>
            </g>
            {/* Transparency toggle */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                let nextOpacity = currentOpacity - 0.2;
                if (nextOpacity < 0.2) nextOpacity = 1.0;
                onUpdate({ opacity: Number(nextOpacity.toFixed(1)) });
              }}
              className="cursor-pointer hover:opacity-80"
              transform="translate(44, 0)"
            >
              <rect x={0} y={0} width={48} height={16} fill="#333" rx={3} />
              <text x={24} y={11} fill="#fff" fontSize={8} textAnchor="middle" fontFamily="sans-serif">
                🌓 Opac: {currentOpacity}
              </text>
            </g>
          </g>
        )}
      </g>
    );
  }
}

// 2. ProtractorObject
export class ProtractorObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    const r = Math.min(this.width, this.height) / 2 - 10;
    const cx = this.width / 2;
    const cy = this.height / 2;

    const ticks: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];

    // Draw 0 to 360 degrees markings
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const tickLength = deg % 10 === 0 ? 15 : (deg % 5 === 0 ? 8 : 4);
      const startR = r - tickLength;
      
      const x1 = cx + startR * Math.cos(rad);
      const y1 = cy + startR * Math.sin(rad);
      const x2 = cx + r * Math.cos(rad);
      const y2 = cy + r * Math.sin(rad);

      ticks.push(
        <line
          key={`prot-tick-${deg}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={this.color}
          strokeWidth={deg % 10 === 0 ? 1.5 : 0.8}
          opacity={0.7}
        />
      );

      // Label every 30 degrees
      if (deg % 30 === 0) {
        const textR = r - 26;
        const tx = cx + textR * Math.cos(rad);
        const ty = cy + textR * Math.sin(rad) + 3;
        labels.push(
          <text
            key={`prot-label-${deg}`}
            x={tx}
            y={ty}
            fill={this.color}
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
            fontWeight="bold"
            opacity={0.9}
          >
            {deg}°
          </text>
        );
      }
    }

    // Interactive pointer angle
    const pointerAngle = this.rawObject.angleValue ?? 45;
    const pointerRad = (pointerAngle * Math.PI) / 180;
    const px = cx + (r - 2) * Math.cos(pointerRad);
    const py = cy + (r - 2) * Math.sin(pointerRad);

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Glass protractor base circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#1C1C1C"
          fillOpacity={0.65}
          stroke={this.color}
          strokeWidth={2}
          className="backdrop-blur-md"
        />

        {/* Center Crosshair */}
        <line x1={cx - 15} y1={cy} x2={cx + 15} y2={cy} stroke={this.color} strokeWidth={1} opacity={0.5} />
        <line x1={cx} y1={cy - 15} x2={cx} y2={cy + 15} stroke={this.color} strokeWidth={1} opacity={0.5} />
        <circle cx={cx} cy={cy} r={3} fill={this.color} />

        {/* Ticks and Labels */}
        <g>{ticks}</g>
        <g>{labels}</g>

        {/* Measurement Pointer Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={px}
          y2={py}
          stroke="#ffd60a"
          strokeWidth={2}
          strokeDasharray="2 2"
        />
        <circle
          cx={px}
          cy={py}
          r={8}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-pointer hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) {
              onStartGeoDrag(this.id, "protractor-needle", e);
            }
          }}
          title="Drag to measure angle"
        />

        {/* Value bubble at bottom center */}
        <g transform={`translate(${cx}, ${cy + 40})`}>
          <rect
            x={-45}
            y={-12}
            width={90}
            height={22}
            fill="#121212"
            fillOpacity={0.8}
            rx={4}
            stroke="#333333"
            strokeWidth={1}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fill="#ffd60a"
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
          >
            Angle: {pointerAngle.toFixed(1)}°
          </text>
        </g>
      </g>
    );
  }
}

// 3. CompassObject
export class CompassObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = this.rawObject.compassRadius ?? 80;

    // Draggable pencil position (radius distance along horizontal axis)
    const px = cx + radius;
    const py = cy;

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Draw a subtle indicator of the circle to be drawn */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={this.color}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
        />

        {/* Center hinge hinge pin */}
        <circle cx={cx} cy={cy} r={6} fill="#888888" stroke="#ffffff" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={2} fill="#000000" />

        {/* Needle Leg */}
        <line
          x1={cx}
          y1={cy}
          x2={cx - 10}
          y2={cy + 40}
          stroke="#dddddd"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <line
          x1={cx - 10}
          y1={cy + 40}
          x2={cx}
          y2={cy + 100}
          stroke="#666666"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Needle point */}
        <polygon points={`${cx},${cy + 100} ${cx - 2},${cy + 108} ${cx + 2},${cy + 108}`} fill="#111" />

        {/* Pencil Leg */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + radius / 2}
          y2={cy + 30}
          stroke="#dddddd"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <line
          x1={cx + radius / 2}
          y1={cy + 30}
          x2={px}
          y2={py}
          stroke="#ffd60a"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Pencil lead tip */}
        <path d={`M ${px} ${py} L ${px - 4} ${py + 8} L ${px + 4} ${py + 8} Z`} fill="#444" />

        {/* Center pointer point label */}
        <text
          x={cx}
          y={cy - 12}
          fill="#fff"
          fontSize={8}
          fontFamily="monospace"
          textAnchor="middle"
        >
          Center
        </text>

        {/* Interactive radius adjustment handle */}
        <circle
          cx={px}
          cy={py}
          r={9}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-ew-resize hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) {
              onStartGeoDrag(this.id, "compass-pencil", e);
            }
          }}
          title="Drag to change radius"
        />

        {/* Live Radius Label */}
        <g transform={`translate(${cx}, ${cy - 30})`}>
          <rect
            x={-55}
            y={-10}
            width={110}
            height={18}
            fill="#121212"
            fillOpacity={0.8}
            rx={3}
            stroke="#444"
            strokeWidth={1}
          />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            fill="#E6E1E5"
            fontSize={8}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
          >
            Radius: {radius}px ({(radius / 3.78).toFixed(0)}mm)
          </text>
        </g>

        {/* Perfect Action triggers on top of compass */}
        {isSelected && (
          <g transform={`translate(${cx - 60}, ${cy - 65})`} className="pointer-events-auto">
            {/* Draw Circle Button */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                if (onAction) onAction("draw_circle", { cx: this.x + cx, cy: this.y + cy, radius });
              }}
              className="cursor-pointer hover:opacity-90"
            >
              <rect x={0} y={0} width={56} height={18} fill="#D0BCFF" rx={4} />
              <text x={28} y={12} fill="#381E72" fontSize={8} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">⭕ Circle</text>
            </g>
            {/* Draw Arc Button */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                if (onAction) onAction("draw_arc", { cx: this.x + cx, cy: this.y + cy, radius });
              }}
              className="cursor-pointer hover:opacity-90"
              transform="translate(62, 0)"
            >
              <rect x={0} y={0} width={56} height={18} fill="#ffd60a" rx={4} />
              <text x={28} y={12} fill="#000" fontSize={8} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">🌙 Arc (180°)</text>
            </g>
          </g>
        )}
      </g>
    );
  }
}

// 4. SetSquareObject
export class SetSquareObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    const is45 = this.shapeType === "geometry_setsquare45";
    
    // Coordinates of outer triangle:
    // Right angle is at (0, height)
    // Vertical side runs to (0, 0)
    // Horizontal side runs to (width, height)
    const pointsOuter = `0,0 0,${this.height} ${this.width},${this.height}`;
    
    // Interior cutout (scaled down right triangle)
    const insetX = 35;
    const insetY = 35;
    const pointsInner = `${insetX},${insetY + 15} ${insetX},${this.height - insetY} ${this.width - insetX - 30},${this.height - insetY}`;

    // Generate tick marks along the edges
    const ticks: React.ReactNode[] = [];
    const pxPerMm = 3.78;

    // 1. Vertical scale (on the left side: 0,0 to 0,height)
    const verticalMm = Math.floor(this.height / pxPerMm);
    for (let mm = 0; mm <= verticalMm; mm++) {
      const pos = mm * pxPerMm;
      const len = mm % 10 === 0 ? 12 : (mm % 5 === 0 ? 8 : 4);
      ticks.push(
        <line
          key={`v-tick-${mm}`}
          x1={0}
          y1={pos}
          x2={len}
          y2={pos}
          stroke={this.color}
          strokeWidth={mm % 10 === 0 ? 1.5 : 0.8}
          opacity={0.6}
        />
      );
    }

    // 2. Horizontal scale (on the bottom side: 0,height to width,height)
    const horizontalMm = Math.floor(this.width / pxPerMm);
    for (let mm = 0; mm <= horizontalMm; mm++) {
      const pos = mm * pxPerMm;
      const len = mm % 10 === 0 ? 12 : (mm % 5 === 0 ? 8 : 4);
      ticks.push(
        <line
          key={`h-tick-${mm}`}
          x1={pos}
          y1={this.height}
          x2={pos}
          y2={this.height - len}
          stroke={this.color}
          strokeWidth={mm % 10 === 0 ? 1.5 : 0.8}
          opacity={0.6}
        />
      );
    }

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Beautiful Drafting Set Square Polygon (using fill rule to create cutout) */}
        <polygon
          points={`${pointsOuter} ${pointsInner}`}
          fill="#1C1C1C"
          fillOpacity={0.6}
          fillRule="evenodd"
          stroke={this.color}
          strokeWidth={2}
          className="backdrop-blur-sm"
        />

        {/* Scales ticks */}
        <g>{ticks}</g>

        {/* Set Square Designation Label */}
        <g transform={`translate(${insetX + 15}, ${this.height - insetY - 45})`}>
          <text
            x={0}
            y={0}
            fill={this.color}
            fontSize={11}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
            opacity={0.8}
          >
            {is45 ? "45°-45°-90°" : "30°-60°-90°"}
          </text>
          <text
            x={0}
            y={12}
            fill="#ffd60a"
            fontSize={8}
            fontFamily="sans-serif"
            fontWeight="bold"
            opacity={0.7}
          >
            📐 ENGINEERING TRIANGLE
          </text>
        </g>
      </g>
    );
  }
}

// 5. Parallel RulerObject
export class ParallelRulerObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    const spacing = this.rawObject.spacing ?? 50;
    const rulerHeight = 22;

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Top Roller/Ruler Bar */}
        <rect
          x={0}
          y={0}
          width={this.width}
          height={rulerHeight}
          fill="#1C1C1C"
          fillOpacity={0.7}
          stroke={this.color}
          strokeWidth={2}
          rx={3}
          className="backdrop-blur-sm"
        />
        {/* Tick marks on top bar */}
        {Array.from({ length: 15 }).map((_, i) => {
          const x = (this.width / 14) * i;
          return (
            <line
              key={`top-tick-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={6}
              stroke={this.color}
              strokeWidth={1}
            />
          );
        })}

        {/* Bottom Roller/Ruler Bar (parallel to top) */}
        <rect
          x={0}
          y={spacing}
          width={this.width}
          height={rulerHeight}
          fill="#1C1C1C"
          fillOpacity={0.7}
          stroke={this.color}
          strokeWidth={2}
          rx={3}
          className="backdrop-blur-sm"
        />
        {/* Tick marks on bottom bar */}
        {Array.from({ length: 15 }).map((_, i) => {
          const x = (this.width / 14) * i;
          return (
            <line
              key={`bot-tick-${i}`}
              x1={x}
              y1={spacing + rulerHeight}
              x2={x}
              y2={spacing + rulerHeight - 6}
              stroke={this.color}
              strokeWidth={1}
            />
          );
        })}

        {/* Hinge Connection Bar Left */}
        <line
          x1={this.width * 0.25}
          y1={rulerHeight / 2}
          x2={this.width * 0.25}
          y2={spacing + rulerHeight / 2}
          stroke="#888"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={this.width * 0.25} cy={rulerHeight / 2} r={3} fill="#fff" />
        <circle cx={this.width * 0.25} cy={spacing + rulerHeight / 2} r={3} fill="#fff" />

        {/* Hinge Connection Bar Right */}
        <line
          x1={this.width * 0.75}
          y1={rulerHeight / 2}
          x2={this.width * 0.75}
          y2={spacing + rulerHeight / 2}
          stroke="#888"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={this.width * 0.75} cy={rulerHeight / 2} r={3} fill="#fff" />
        <circle cx={this.width * 0.75} cy={spacing + rulerHeight / 2} r={3} fill="#fff" />

        {/* Interactive Spacing adjustment grip inside bottom bar */}
        <circle
          cx={this.width / 2}
          cy={spacing + rulerHeight / 2}
          r={7}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-ns-resize hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) {
              onStartGeoDrag(this.id, "parallel-spacing", e);
            }
          }}
          title="Drag to change parallel gap"
        />

        {/* Parallel Spacing Info Label */}
        <text
          x={this.width / 2}
          y={spacing / 2 + 5}
          fill={this.color}
          fontSize={8}
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
          fontWeight="bold"
          opacity={0.7}
        >
          平行 Parallel: {spacing}px ({(spacing / 3.78).toFixed(1)}mm)
        </text>
      </g>
    );
  }
}

// 6. CircleTemplateObject
export class CircleTemplateObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    // Define diameters of 4 template circles
    const sizes = [15, 25, 40, 55];
    const stepX = this.width / 5;

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Translucent stencil board */}
        <rect
          x={0}
          y={0}
          width={this.width}
          height={this.height}
          fill="#D0BCFF"
          fillOpacity={0.12}
          stroke={this.color}
          strokeWidth={2}
          rx={12}
        />

        {/* Centered Stencil Label */}
        <text
          x={this.width / 2}
          y={this.height - 12}
          fill={this.color}
          fontSize={8}
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
          fontWeight="bold"
          opacity={0.8}
        >
          ● CIRCLE STENCIL TEMPLATE
        </text>

        {/* Draw circle cutouts with tick marks and Action buttons */}
        {sizes.map((r, idx) => {
          const cx = stepX * (idx + 1);
          const cy = this.height / 2 - 10;

          return (
            <g key={`cutout-${idx}`} className="pointer-events-auto">
              {/* Circular template cutout */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={this.color}
                strokeWidth={1.2}
                strokeDasharray="4 2"
                opacity={0.7}
              />
              {/* Crosshair ticks */}
              <line x1={cx - r - 6} y1={cy} x2={cx - r} y2={cy} stroke={this.color} strokeWidth={1} opacity={0.5} />
              <line x1={cx + r} y1={cy} x2={cx + r + 6} y2={cy} stroke={this.color} strokeWidth={1} opacity={0.5} />
              <line x1={cx} y1={cy - r - 6} x2={cx} y2={cy - r} stroke={this.color} strokeWidth={1} opacity={0.5} />
              <line x1={cx} y1={cy + r} x2={cx} y2={cy + r + 6} stroke={this.color} strokeWidth={1} opacity={0.5} />

              {/* Diameter label */}
              <text
                x={cx}
                y={cy - r - 10}
                fill={this.color}
                fontSize={7}
                fontFamily="monospace"
                textAnchor="middle"
              >
                Ø{(r * 2 / 3.78).toFixed(0)}mm
              </text>

              {/* Trigger Stamp button */}
              {isSelected && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAction) {
                      onAction("stamp_circle", { cx: this.x + cx, cy: this.y + cy, radius: r });
                    }
                  }}
                  className="cursor-pointer hover:scale-110 transition-transform"
                  transform={`translate(${cx - 18}, ${cy + r + 6})`}
                >
                  <rect x={0} y={0} width={36} height={12} fill="#333" rx={2} stroke={this.color} strokeWidth={0.5} />
                  <text x={18} y={9} fill="#fff" fontSize={6} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">Stamp</text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  }
}

// 7. EllipseTemplateObject
export class EllipseTemplateObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    const cx = this.width / 2;
    const cy = this.height / 2;

    const rx = this.rawObject.majorAxis ?? (this.width / 2.5);
    const ry = this.rawObject.minorAxis ?? (this.height / 3.5);

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Transparent plastic stencil card */}
        <rect
          x={0}
          y={0}
          width={this.width}
          height={this.height}
          fill="#D0BCFF"
          fillOpacity={0.08}
          stroke={this.color}
          strokeWidth={2}
          rx={8}
        />

        {/* Elliptical hole cutout */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={this.color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {/* Center guidelines */}
        <line x1={cx - rx - 10} y1={cy} x2={cx + rx + 10} y2={cy} stroke={this.color} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.4} />
        <line x1={cx} y1={cy - ry - 10} x2={cx} y2={cy + ry + 10} stroke={this.color} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.4} />

        {/* Label */}
        <text
          x={cx}
          y={cy - ry - 12}
          fill={this.color}
          fontSize={8}
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
          fontWeight="bold"
        >
          ELLIPSE TEMPLATE
        </text>

        {/* Axis sliders / Drag controls */}
        {isSelected && (
          <g className="pointer-events-auto">
            {/* Horizontal axis drag handle */}
            <circle
              cx={cx + rx}
              cy={cy}
              r={7}
              fill="#ffd60a"
              stroke="#121212"
              strokeWidth={1}
              className="cursor-ew-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onStartGeoDrag) onStartGeoDrag(this.id, "ellipse-rx", e);
              }}
              title="Drag to change major axis"
            />
            {/* Vertical axis drag handle */}
            <circle
              cx={cx}
              cy={cy + ry}
              r={7}
              fill="#ffd60a"
              stroke="#121212"
              strokeWidth={1}
              className="cursor-ns-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onStartGeoDrag) onStartGeoDrag(this.id, "ellipse-ry", e);
              }}
              title="Drag to change minor axis"
            />

            {/* Stamp Ellipse Button */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                if (onAction) onAction("stamp_ellipse", { cx: this.x + cx, cy: this.y + cy, rx, ry });
              }}
              className="cursor-pointer hover:opacity-90"
              transform={`translate(${cx - 35}, ${cy - 10})`}
            >
              <rect x={0} y={0} width={70} height={20} fill="#ffd60a" rx={4} />
              <text x={35} y={13} fill="#000" fontSize={9} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">✏️ Stamp</text>
            </g>
          </g>
        )}
      </g>
    );
  }
}

// 8. MeasurementToolObject
export class MeasurementToolObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    // Use absolute coordinates stored as local parameters, or default
    const p1 = this.rawObject.p1 ?? { x: 30, y: this.height / 2 };
    const p2 = this.rawObject.p2 ?? { x: this.width - 30, y: this.height / 2 };

    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const distanceMm = (distance / 3.78).toFixed(1);

    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Connecting Dimension Line */}
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={this.color}
          strokeWidth={2}
        />

        {/* Arrowheads at ends of dimension line */}
        {(() => {
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const arrowLen = 10;
          const arrowWidth = 5;

          const p1Arrow1 = {
            x: p1.x + arrowLen * Math.cos(angle - Math.PI / 6),
            y: p1.y + arrowLen * Math.sin(angle - Math.PI / 6),
          };
          const p1Arrow2 = {
            x: p1.x + arrowLen * Math.cos(angle + Math.PI / 6),
            y: p1.y + arrowLen * Math.sin(angle + Math.PI / 6),
          };

          const p2Arrow1 = {
            x: p2.x - arrowLen * Math.cos(angle - Math.PI / 6),
            y: p2.y - arrowLen * Math.sin(angle - Math.PI / 6),
          };
          const p2Arrow2 = {
            x: p2.x - arrowLen * Math.cos(angle + Math.PI / 6),
            y: p2.y - arrowLen * Math.sin(angle + Math.PI / 6),
          };

          return (
            <g>
              <polygon points={`${p1.x},${p1.y} ${p1Arrow1.x},${p1Arrow1.y} ${p1Arrow2.x},${p1Arrow2.y}`} fill={this.color} />
              <polygon points={`${p2.x},${p2.y} ${p2Arrow1.x},${p2Arrow1.y} ${p2Arrow2.x},${p2Arrow2.y}`} fill={this.color} />
            </g>
          );
        })()}

        {/* Distance Display Card */}
        <g transform={`translate(${mx}, ${my - 22})`}>
          <rect
            x={-60}
            y={-10}
            width={120}
            height={20}
            fill="#121212"
            fillOpacity={0.9}
            rx={4}
            stroke={this.color}
            strokeWidth={1}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fill="#86efac"
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
          >
            📐 {distanceMm} mm ({Math.round(distance)} px)
          </text>
        </g>

        {/* Drag handles at endpoints */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={9}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-move hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) onStartGeoDrag(this.id, "measure-p1", e);
          }}
          title="Drag starting point"
        />
        <circle
          cx={p2.x}
          cy={p2.y}
          r={9}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-move hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) onStartGeoDrag(this.id, "measure-p2", e);
          }}
          title="Drag ending point"
        />
      </g>
    );
  }
}

// 9. AngleMeasurementObject
export class AngleMeasurementObject extends GeometryObject {
  render(
    isSelected: boolean,
    onUpdate: (updatedFields: Partial<CanvasObject>) => void,
    onStartGeoDrag?: (objId: string, handleId: string, e: React.MouseEvent) => void,
    onAction?: (actionType: string, params?: any) => void
  ): React.ReactNode {
    if (this.hidden) return null;

    // We have three points:
    // p1: Center / vertex
    // p2: End point 1 of first ray
    // p3: End point 2 of second ray
    const p1 = this.rawObject.p1 ?? { x: this.width / 2, y: this.height / 2 + 20 };
    const p2 = this.rawObject.p2 ?? { x: this.width * 0.15, y: this.height / 2 - 20 };
    const p3 = this.rawObject.p3 ?? { x: this.width * 0.85, y: this.height / 2 - 20 };

    // Calculate angles of rays in degrees
    const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angle2 = Math.atan2(p3.y - p1.y, p3.x - p1.x);

    let diffAngleRad = angle2 - angle1;
    // Normalize difference angle to [0, 2pi)
    if (diffAngleRad < 0) diffAngleRad += Math.PI * 2;
    let diffAngleDeg = diffAngleRad * (180 / Math.PI);
    if (diffAngleDeg > 180) diffAngleDeg = 360 - diffAngleDeg; // measure interior angle

    // Render an arc between the two rays near vertex p1
    const arcRadius = 40;
    const startX = p1.x + arcRadius * Math.cos(angle1);
    const startY = p1.y + arcRadius * Math.sin(angle1);
    const endX = p1.x + arcRadius * Math.cos(angle2);
    const endY = p1.y + arcRadius * Math.sin(angle2);

    // Large-arc-flag is 0 since we want the smaller interior angle
    const pathD = `M ${startX} ${startY} A ${arcRadius} ${arcRadius} 0 0 1 ${endX} ${endY}`;

    return (
      <g style={{ opacity: this.opacity }}>
        {/* Rays from vertex */}
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={this.color} strokeWidth={2.5} />
        <line x1={p1.x} y1={p1.y} x2={p3.x} y2={p3.y} stroke={this.color} strokeWidth={2.5} />

        {/* Angle Measurement arc */}
        <path
          d={pathD}
          fill="none"
          stroke="#ffd60a"
          strokeWidth={2}
          strokeDasharray="2 2"
        />

        {/* Angle Value overlay label */}
        <g transform={`translate(${p1.x}, ${p1.y - arcRadius - 15})`}>
          <rect
            x={-35}
            y={-9}
            width={70}
            height={18}
            fill="#121212"
            fillOpacity={0.9}
            rx={3}
            stroke={this.color}
            strokeWidth={1}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fill="#ffd60a"
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
          >
            {diffAngleDeg.toFixed(1)}°
          </text>
        </g>

        {/* Interactive Draggable handle points */}
        {/* Vertex point */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={10}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={2}
          className="cursor-move hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) onStartGeoDrag(this.id, "angle-p1", e);
          }}
          title="Drag Vertex"
        />
        <text x={p1.x} y={p1.y + 22} fill="#E6E1E5" fontSize={7} textAnchor="middle" fontFamily="monospace">Vertex</text>

        {/* Ray point 1 */}
        <circle
          cx={p2.x}
          cy={p2.y}
          r={8}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-move hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) onStartGeoDrag(this.id, "angle-p2", e);
          }}
          title="Drag Point 1"
        />

        {/* Ray point 2 */}
        <circle
          cx={p3.x}
          cy={p3.y}
          r={8}
          fill="#ffd60a"
          stroke="#121212"
          strokeWidth={1.5}
          className="cursor-move hover:scale-125 transition-transform"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onStartGeoDrag) onStartGeoDrag(this.id, "angle-p3", e);
          }}
          title="Drag Point 2"
        />
      </g>
    );
  }
}

// Global factory helper to instantiate GeometryObjects
export function getGeometryObject(obj: CanvasObject): GeometryObject | null {
  if (obj.type !== "shape") return null;
  if (!obj.shapeType || !obj.shapeType.startsWith("geometry_")) return null;

  switch (obj.shapeType) {
    case "geometry_ruler":
      return new SmartRulerObject(obj);
    case "geometry_protractor":
      return new ProtractorObject(obj);
    case "geometry_compass":
      return new CompassObject(obj);
    case "geometry_setsquare30":
    case "geometry_setsquare45":
      return new SetSquareObject(obj);
    case "geometry_parallel_ruler":
      return new ParallelRulerObject(obj);
    case "geometry_circle_template":
      return new CircleTemplateObject(obj);
    case "geometry_ellipse_template":
      return new EllipseTemplateObject(obj);
    case "geometry_measurement":
      return new MeasurementToolObject(obj);
    case "geometry_angle_measurement":
      return new AngleMeasurementObject(obj);
    default:
      return null;
  }
}

// Master Snapping coordinate mapping algorithm for rulers and set squares
export function getSnappingCoordinates(
  coords: { x: number; y: number },
  canvasObjects: CanvasObject[],
  threshold = 25
): { x: number; y: number; snapped: boolean; detail?: string } | null {
  for (const obj of canvasObjects) {
    if (obj.hidden || obj.isLocked || obj.type !== "shape" || !obj.shapeType) continue;

    // 1. Smart Ruler edge snap
    if (obj.shapeType === "geometry_ruler") {
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const rad = ((obj.rotation || 0) * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const nx = -Math.sin(rad);
      const ny = Math.cos(rad);

      const vx = coords.x - cx;
      const vy = coords.y - cy;

      const proj_dist = vx * dx + vy * dy;
      const norm_dist = vx * nx + vy * ny;

      const thickness = obj.height;
      const half_len = obj.width / 2;

      if (Math.abs(proj_dist) <= half_len + 15) {
        const top_edge = -thickness / 2;
        const bottom_edge = thickness / 2;

        let snap_norm = null;
        if (Math.abs(norm_dist - top_edge) < threshold) {
          snap_norm = top_edge;
        } else if (Math.abs(norm_dist - bottom_edge) < threshold) {
          snap_norm = bottom_edge;
        }

        if (snap_norm !== null) {
          const clamped_proj = Math.max(-half_len, Math.min(half_len, proj_dist));
          return {
            x: cx + clamped_proj * dx + snap_norm * nx,
            y: cy + clamped_proj * dy + snap_norm * ny,
            snapped: true,
            detail: `${Math.round((clamped_proj + half_len) / 3.78)} mm`
          };
        }
      }
    }

    // 2. Set Squares edge snap
    if (obj.shapeType === "geometry_setsquare30" || obj.shapeType === "geometry_setsquare45") {
      // The triangle vertices in local coordinate space:
      // A (0, 0), B (0, height), C (width, height)
      // Since the triangle itself is rotated/translated, let's map vertices into global space
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const rad = ((obj.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const transformLocalToGlobal = (lx: number, ly: number) => {
        // center coordinate shift
        const rx = lx - obj.width / 2;
        const ry = ly - obj.height / 2;
        return {
          x: cx + rx * cos - ry * sin,
          y: cy + rx * sin + ry * cos
        };
      };

      const a = transformLocalToGlobal(0, 0);
      const b = transformLocalToGlobal(0, obj.height);
      const c = transformLocalToGlobal(obj.width, obj.height);

      // Snap cursor against the three global segments: AB, BC, CA
      const segments = [
        { start: a, end: b },
        { start: b, end: c },
        { start: c, end: a }
      ];

      let bestSnap: { x: number; y: number; dist: number } | null = null;

      for (const seg of segments) {
        const abX = seg.end.x - seg.start.x;
        const abY = seg.end.y - seg.start.y;
        const apX = coords.x - seg.start.x;
        const apY = coords.y - seg.start.y;

        const abLen2 = abX * abX + abY * abY;
        if (abLen2 === 0) continue;

        let t = (apX * abX + apY * abY) / abLen2;
        t = Math.max(0, Math.min(1, t));

        const projX = seg.start.x + t * abX;
        const projY = seg.start.y + t * abY;

        const dist = Math.hypot(coords.x - projX, coords.y - projY);
        if (dist < threshold) {
          if (!bestSnap || dist < bestSnap.dist) {
            bestSnap = { x: projX, y: projY, dist };
          }
        }
      }

      if (bestSnap) {
        return {
          x: bestSnap.x,
          y: bestSnap.y,
          snapped: true,
          detail: "Set Square Edge"
        };
      }
    }
  }

  return null;
}
