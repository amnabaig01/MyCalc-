import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  FileQuestion,
  Lightbulb,
  ArrowRight,
  Calculator,
  PenTool,
  Upload,
  Eraser,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';
import { AngleMode } from '../utils/mathEngine';

interface AiSolverDrawerProps {
  currentExpression: string;
  currentResult: string;
  angleMode: AngleMode;
  onApplyExpression: (expr: string) => void;
  onPlotFunction?: (fnStr: string) => void;
}

interface Step {
  stepNumber?: number;
  step?: number;
  title?: string;
  explanation?: string;
  subExpression?: string;
  rule?: string;
  math?: string;
  value?: string;
}

export const AiSolverDrawer: React.FC<AiSolverDrawerProps> = ({
  currentExpression,
  currentResult,
  angleMode,
  onApplyExpression,
  onPlotFunction,
}) => {
  const [activeTab, setActiveTab] = useState<'problem' | 'explain' | 'draw'>('problem');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Solved result states
  const [solveData, setSolveData] = useState<{
    expression?: string;
    numericResult?: string;
    exactResult?: string;
    summary?: string;
    steps?: Step[];
    formulaUsed?: string;
    graphableFunction?: string | null;
    units?: string;
  } | null>(null);

  // Explanation result states
  const [explainData, setExplainData] = useState<{
    title?: string;
    overview?: string;
    steps?: Step[];
    alternateRepresentations?: string[];
    mathematicalInsight?: string;
  } | null>(null);

  // Drawing Canvas refs & states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Canvas drawing setup
  useEffect(() => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
    }
  }, [activeTab]);

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const handleStopDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Solve word problem or equation
  const handleSolve = async (customQuery?: string) => {
    const q = customQuery || query;
    if (!q.trim()) return;
    setIsLoading(true);
    setError(null);
    setSolveData(null);

    try {
      const res = await fetch('/api/ai/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, angleMode }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server error occurred');
      }

      const data = await res.json();
      setSolveData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to solve problem.');
    } finally {
      setIsLoading(false);
    }
  };

  // Explain current calculation
  const handleExplainCurrent = async () => {
    if (!currentExpression.trim()) {
      setError('Please perform a calculation first to explain it.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setExplainData(null);

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression: currentExpression,
          result: currentResult,
          angleMode,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server error occurred');
      }

      const data = await res.json();
      setExplainData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate explanation.');
    } finally {
      setIsLoading(false);
    }
  };

  // OCR solve drawn image
  const handleSolveDrawnImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'OCR recognition failed.');
      }

      const data = await res.json();
      setSolveData({
        expression: data.calculatorExpression,
        numericResult: data.result,
        summary: data.transcribedText,
        steps: data.explanationSteps?.map((st: string, idx: number) => ({
          stepNumber: idx + 1,
          title: `Step ${idx + 1}`,
          explanation: st,
          math: '',
        })),
        graphableFunction: data.graphableFunction,
      });
      setActiveTab('problem');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze handwriting.');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload image handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (!base64) return;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/ai/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/png' }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'OCR recognition failed.');
        }

        const data = await res.json();
        setSolveData({
          expression: data.calculatorExpression,
          numericResult: data.result,
          summary: data.transcribedText,
          steps: data.explanationSteps?.map((st: string, idx: number) => ({
            stepNumber: idx + 1,
            title: `Step ${idx + 1}`,
            explanation: st,
            math: '',
          })),
          graphableFunction: data.graphableFunction,
        });
        setActiveTab('problem');
      } catch (err: any) {
        setError(err.message || 'Failed to process image.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const samplePrompts = [
    'Find hypotenuse with legs 7 and 24',
    'Calculate monthly mortgage payment for $300k at 6.5% for 30 yrs',
    'Integrate 3x^2 - 4x + 5 from 0 to 3',
    'Volume and surface area of cylinder radius 4cm height 10cm',
    'Solve quadratic 2x^2 + 5x - 12 = 0',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header with Navigation Tabs */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-slate-200">
            Gemini Math Intelligence
          </span>
        </div>

        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('problem')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'problem'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            Word Problem
          </button>
          <button
            onClick={() => {
              setActiveTab('explain');
              if (!explainData) handleExplainCurrent();
            }}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'explain'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Explain Step-by-Step
          </button>
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'draw'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Draw / OCR
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* TAB 1: Natural Language Problem Solver */}
        {activeTab === 'problem' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Enter word problem, physics equation, or natural language query:</span>
                <span className="text-[11px] text-cyan-400">Angle Mode: {angleMode}</span>
              </label>
              <div className="relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSolve();
                    }
                  }}
                  rows={2}
                  placeholder="e.g. Find the hypotenuse of a right triangle with legs 7 and 24..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none resize-none"
                />
                <button
                  onClick={() => handleSolve()}
                  disabled={isLoading || !query.trim()}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Solve
                </button>
              </div>
            </div>

            {/* Quick Inspiration Prompts */}
            {!solveData && !isLoading && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                  Try asking:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(p);
                        handleSolve(p);
                      }}
                      className="text-xs bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 px-2.5 py-1 rounded-lg border border-slate-700/60 transition text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Solved Results Presentation */}
            {solveData && (
              <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 animate-in fade-in">
                {/* Summary & Answer Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                      AI Solution
                    </span>
                    <h3 className="text-sm font-medium text-slate-200 mt-0.5">
                      {solveData.summary}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400">Result</span>
                    <div className="text-lg font-mono font-bold text-emerald-400">
                      {solveData.numericResult} {solveData.units || ''}
                    </div>
                    {solveData.exactResult && solveData.exactResult !== solveData.numericResult && (
                      <div className="text-xs font-mono text-cyan-300">
                        Exact: {solveData.exactResult}
                      </div>
                    )}
                  </div>
                </div>

                {/* Formula used */}
                {solveData.formulaUsed && (
                  <div className="flex items-center gap-2 p-2 bg-slate-900/80 rounded-lg text-xs font-mono text-slate-300 border border-slate-800">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{solveData.formulaUsed}</span>
                  </div>
                )}

                {/* Action buttons: Send to Calc & Plot */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {solveData.expression && (
                    <button
                      onClick={() => onApplyExpression(solveData.expression!)}
                      className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Apply to Calculator ({solveData.expression})
                    </button>
                  )}
                  {solveData.graphableFunction && onPlotFunction && (
                    <button
                      onClick={() => onPlotFunction(solveData.graphableFunction!)}
                      className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Plot Graph f(x) = {solveData.graphableFunction}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(solveData.numericResult || '')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Result
                  </button>
                </div>

                {/* Step-by-step breakdown */}
                {solveData.steps && solveData.steps.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      Step-by-Step Derivation
                    </span>
                    <div className="space-y-2">
                      {solveData.steps.map((st, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-slate-900/90 border border-slate-800/80 rounded-lg text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold text-slate-300">
                            <span>
                              {st.stepNumber || i + 1}. {st.title}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[12px] leading-relaxed">
                            {st.explanation}
                          </p>
                          {st.math && (
                            <div className="font-mono text-cyan-300 bg-slate-950 px-2 py-1 rounded text-[11px] border border-slate-800/80">
                              {st.math}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Explain Current Calculator Expression */}
        {activeTab === 'explain' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-400 font-mono">Current Calculator Input</span>
                <div className="text-sm font-mono font-bold text-cyan-300 truncate max-w-[280px]">
                  {currentExpression || '0'} = {currentResult || '0'}
                </div>
              </div>
              <button
                onClick={handleExplainCurrent}
                disabled={isLoading || !currentExpression.trim()}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Re-Explain
              </button>
            </div>

            {explainData && (
              <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-200">
                  {explainData.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {explainData.overview}
                </p>

                {explainData.mathematicalInsight && (
                  <div className="p-2.5 bg-indigo-950/30 border border-indigo-800/60 rounded-lg text-xs text-indigo-300 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{explainData.mathematicalInsight}</span>
                  </div>
                )}

                {explainData.alternateRepresentations && explainData.alternateRepresentations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {explainData.alternateRepresentations.map((alt, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded font-mono text-[11px] border border-slate-700/60"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Steps */}
                {explainData.steps && explainData.steps.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Step-by-Step Order of Operations (PEMDAS)
                    </span>
                    <div className="space-y-2">
                      {explainData.steps.map((st, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-300 font-medium">
                            <span>Step {st.step || i + 1}: {st.rule}</span>
                            <span className="font-mono text-cyan-400 font-bold">{st.value}</span>
                          </div>
                          {st.subExpression && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              Computing: <span className="text-slate-300">{st.subExpression}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Digital Drawing Board & OCR Photo Recognition */}
        {activeTab === 'draw' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Write or sketch math with touch/mouse, or upload a photo:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={clearCanvas}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition"
                >
                  <Eraser className="w-3 h-3" />
                  Clear
                </button>
                <label className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 cursor-pointer transition">
                  <Upload className="w-3 h-3" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Drawing Canvas */}
            <div className="relative border-2 border-dashed border-slate-700 rounded-xl overflow-hidden bg-slate-950">
              <canvas
                ref={canvasRef}
                width={500}
                height={220}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDrawMove}
                onMouseUp={handleStopDraw}
                onMouseLeave={handleStopDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDrawMove}
                onTouchEnd={handleStopDraw}
                className="w-full h-[220px] cursor-crosshair block touch-none"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none select-none">
                  <PenTool className="w-8 h-8 mb-2 stroke-1" />
                  <span className="text-xs font-medium">Draw math formula here (e.g. √(64) + 5²)</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSolveDrawnImage}
              disabled={isLoading || !hasDrawn}
              className="w-full py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning and Solving Formula...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Recognize & Solve Handwritten Math
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
