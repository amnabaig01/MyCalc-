import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Sparkles } from 'lucide-react';
import { evaluateFunctionAtX, AngleMode } from '../utils/mathEngine';

interface GraphPlotterProps {
  initialFunction?: string;
  angleMode?: AngleMode;
  onInsertToCalc?: (expr: string) => void;
}

export const GraphPlotter: React.FC<GraphPlotterProps> = ({
  initialFunction = 'sin(x)',
  angleMode = 'RAD',
  onInsertToCalc,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fnExpr, setFnExpr] = useState(initialFunction);
  const [viewState, setViewState] = useState({
    centerX: 0,
    centerY: 0,
    scale: 40, // pixels per unit
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number; mathX: number; mathY: number } | null>(null);

  // Sync if prop changes
  useEffect(() => {
    if (initialFunction && initialFunction !== fnExpr) {
      setFnExpr(initialFunction);
    }
  }, [initialFunction]);

  const presets = [
    { label: 'sin(x)', expr: 'sin(x)' },
    { label: 'cos(x)', expr: 'cos(x)' },
    { label: 'x² - 4', expr: 'x^2 - 4' },
    { label: 'x³ - 3x', expr: 'x^3 - 3*x' },
    { label: '1/x', expr: '1/x' },
    { label: 'e^(-x²)', expr: 'e^(-(x^2))' },
    { label: 'ln(x)', expr: 'ln(x)' },
    { label: '√x', expr: 'sqrt(x)' },
  ];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const { centerX, centerY, scale } = viewState;

    const originX = width / 2 - centerX * scale;
    const originY = height / 2 + centerY * scale;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid settings
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e293b';

    // Step size based on scale
    let step = 1;
    if (scale < 15) step = 5;
    if (scale < 5) step = 10;
    if (scale > 100) step = 0.5;
    if (scale > 200) step = 0.2;

    const minX = -originX / scale;
    const maxX = (width - originX) / scale;
    const minY = -(height - originY) / scale;
    const maxY = originY / scale;

    // Grid lines & labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#64748b';

    // Vertical grid
    const startGridX = Math.floor(minX / step) * step;
    for (let x = startGridX; x <= maxX; x += step) {
      const px = originX + x * scale;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();

      if (Math.abs(x) > 0.0001) {
        ctx.fillText(Number(x.toFixed(2)).toString(), px + 4, originY - 4 > height - 12 ? height - 4 : originY - 4 < 12 ? 14 : originY - 4);
      }
    }

    // Horizontal grid
    const startGridY = Math.floor(minY / step) * step;
    for (let y = startGridY; y <= maxY; y += step) {
      const py = originY - y * scale;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();

      if (Math.abs(y) > 0.0001) {
        ctx.fillText(Number(y.toFixed(2)).toString(), originX + 4 > width - 24 ? width - 24 : originX + 4 < 4 ? 4 : originX + 4, py - 4);
      }
    }

    // Main Axes
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#475569';
    // X Axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
    // Y Axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Plot Function f(x)
    if (fnExpr.trim()) {
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#06b6d4'; // Cyan neon
      ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';
      ctx.shadowBlur = 8;

      let started = false;
      const stepPixel = 2; // sample every 2px
      for (let px = 0; px <= width; px += stepPixel) {
        const mathX = (px - originX) / scale;
        const mathY = evaluateFunctionAtX(fnExpr, mathX, angleMode);

        if (Number.isFinite(mathY)) {
          const py = originY - mathY * scale;
          // check if within reasonable bounds to prevent erratic jumps across asymptotes
          if (py >= -height * 2 && py <= height * 3) {
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else {
              ctx.lineTo(px, py);
            }
          } else {
            started = false;
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw mouse crosshair and coordinate badge
    if (mousePos) {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, height);
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(width, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point on curve
      const curveY = evaluateFunctionAtX(fnExpr, mousePos.mathX, angleMode);
      if (Number.isFinite(curveY)) {
        const curvePy = originY - curveY * scale;
        ctx.beginPath();
        ctx.arc(mousePos.x, curvePy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [viewState, fnExpr, angleMode, mousePos]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse pan & zoom handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const { centerX, centerY, scale } = viewState;
    const originX = rect.width / 2 - centerX * scale;
    const originY = rect.height / 2 + centerY * scale;

    const mathX = (px - originX) / scale;
    const mathY = (originY - py) / scale;

    setMousePos({ x: px, y: py, mathX, mathY });

    if (isDragging) {
      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;
      setViewState((prev) => ({
        ...prev,
        centerX: prev.centerX - dx,
        centerY: prev.centerY + dy,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setMousePos(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(5, Math.min(600, prev.scale * zoomFactor)),
    }));
  };

  const zoomIn = () => {
    setViewState((prev) => ({ ...prev, scale: Math.min(600, prev.scale * 1.3) }));
  };
  const zoomOut = () => {
    setViewState((prev) => ({ ...prev, scale: Math.max(5, prev.scale * 0.77) }));
  };
  const resetView = () => {
    setViewState({ centerX: 0, centerY: 0, scale: 40 });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Top Header / Input Bar */}
      <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <span className="text-cyan-400 font-mono font-bold text-sm">f(x) =</span>
          <input
            type="text"
            value={fnExpr}
            onChange={(e) => setFnExpr(e.target.value)}
            placeholder="e.g. sin(x), x^2 - 4"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            title="Reset Origin"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onInsertToCalc && (
            <button
              onClick={() => onInsertToCalc(fnExpr)}
              title="Copy to calculator"
              className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-xs font-medium rounded-lg border border-cyan-500/40 transition flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Use in Calc
            </button>
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">Presets:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setFnExpr(p.expr)}
            className={`px-2 py-0.5 rounded font-mono transition text-[11px] whitespace-nowrap ${
              fnExpr === p.expr
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 min-h-[300px] w-full overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover coordinate badge */}
        {mousePos && (
          <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 pointer-events-none shadow-lg">
            <span>X: {mousePos.mathX.toFixed(3)}</span>
            <span className="mx-1.5 text-slate-500">|</span>
            <span>
              Y: {evaluateFunctionAtX(fnExpr, mousePos.mathX, angleMode).toFixed(3)}
            </span>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-2 pointer-events-none text-[11px] text-slate-500 font-mono bg-slate-950/60 px-2 py-0.5 rounded backdrop-blur">
          <Crosshair className="w-3 h-3 text-cyan-500" />
          <span>Drag to pan · Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
};
