import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  Delete,
  Copy,
  Check,
  HelpCircle,
  Percent,
  Divide,
  X,
  Minus,
  Plus,
  Equal,
  ChevronRight,
  Maximize2,
  Layers,
} from 'lucide-react';
import {
  evaluateMath,
  AngleMode,
  formatNumber,
} from './utils/mathEngine';
import { sound } from './utils/sound';
import { GraphPlotter } from './components/GraphPlotter';
import { AiSolverDrawer } from './components/AiSolverDrawer';
import { HistoryTape, HistoryItem } from './components/HistoryTape';
import { UnitConverter } from './components/UnitConverter';

export default function App() {
  const [expression, setExpression] = useState('');
  const [livePreview, setLivePreview] = useState<string>('0');
  const [evaluatedResult, setEvaluatedResult] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string>('0');
  const [memory, setMemory] = useState<number>(0);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [isSecond, setIsSecond] = useState(false);
  const [isHyp, setIsHyp] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  // Right-side workbench tool tab: 'ai' | 'graph' | 'tape' | 'units'
  const [activeTab, setActiveTab] = useState<'ai' | 'graph' | 'tape' | 'units'>('ai');
  const [graphFunc, setGraphFunc] = useState('sin(x)');

  // Calculation History
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('apex_calc_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch {
      // Ignore
    }
    return [];
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('apex_calc_history', JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  // Sync sound settings
  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  // Compute live preview calculation whenever expression changes
  useEffect(() => {
    if (!expression.trim()) {
      setLivePreview('0');
      return;
    }

    const evalRes = evaluateMath(expression, angleMode);
    if (evalRes.success) {
      setLivePreview(evalRes.formatted + (evalRes.fraction ? ` [${evalRes.fraction}]` : ''));
    } else {
      // don't show noisy error during intermediate typing
      setLivePreview('');
    }
  }, [expression, angleMode]);

  // Insert token / character into expression
  const insertToken = useCallback((token: string) => {
    sound.playKeyClick();
    sound.vibrate(8);

    setExpression((prev) => {
      // If we just evaluated an expression and user presses an operator, continue with result
      if (evaluatedResult !== null) {
        setEvaluatedResult(null);
        if (['+', '-', '×', '÷', '^', '%', 'mod'].includes(token)) {
          return evaluatedResult + token;
        }
        return token;
      }
      return prev + token;
    });
  }, [evaluatedResult]);

  // Handle scientific function insertion like sin(, cos(, etc.
  const insertFunc = useCallback((fnName: string) => {
    sound.playKeyClick(700);
    sound.vibrate(10);

    setExpression((prev) => {
      if (evaluatedResult !== null) {
        setEvaluatedResult(null);
        return `${fnName}(`;
      }
      return `${prev}${fnName}(`;
    });
  }, [evaluatedResult]);

  // Clear all (AC)
  const handleClear = useCallback(() => {
    sound.playKeyClick(400);
    sound.vibrate(12);
    setExpression('');
    setEvaluatedResult(null);
    setLivePreview('0');
  }, []);

  // Backspace (DEL)
  const handleDelete = useCallback(() => {
    sound.playKeyClick(500);
    sound.vibrate(6);
    setExpression((prev) => {
      if (!prev) return '';
      // Check if ending with a function like "sin(" or "sqrt("
      const match = prev.match(/([a-zA-Z0-9_⁻¹]+[(])$/);
      if (match) {
        return prev.slice(0, prev.length - match[0].length);
      }
      return prev.slice(0, -1);
    });
  }, []);

  // Evaluate Expression (=)
  const handleCalculate = useCallback(() => {
    if (!expression.trim()) return;

    // Automatically close any unclosed parentheses
    let cleanExpr = expression;
    const openParens = (cleanExpr.match(/\(/g) || []).length;
    const closeParens = (cleanExpr.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      cleanExpr += ')'.repeat(openParens - closeParens);
      setExpression(cleanExpr);
    }

    const evalRes = evaluateMath(cleanExpr, angleMode);

    if (evalRes.success) {
      sound.playEquals();
      sound.vibrate(20);
      setEvaluatedResult(evalRes.formatted);
      setLastAnswer(evalRes.formatted);

      // Add to calculation history
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date(),
        expression: cleanExpr,
        result: evalRes.formatted,
        fraction: evalRes.fraction,
        angleMode,
      };

      setHistory((prev) => [newItem, ...prev.slice(0, 49)]); // keep last 50 items
    } else {
      sound.playError();
      sound.vibrate(35);
      setEvaluatedResult(evalRes.error || 'Error');
    }
  }, [expression, angleMode]);

  // Negate sign (±)
  const handleNegate = () => {
    sound.playKeyClick();
    if (!expression) {
      setExpression('-');
      return;
    }
    if (expression.startsWith('-(') && expression.endsWith(')')) {
      setExpression(expression.slice(2, -1));
    } else {
      setExpression(`-(${expression})`);
    }
  };

  // Memory Actions
  const handleMemory = (action: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') => {
    sound.playKeyClick(650);
    const currentVal = parseFloat(evaluatedResult || livePreview || '0') || 0;

    switch (action) {
      case 'MC':
        setMemory(0);
        break;
      case 'MR':
        insertToken(formatNumber(memory));
        break;
      case 'M+':
        setMemory((m) => m + currentVal);
        break;
      case 'M-':
        setMemory((m) => m - currentVal);
        break;
      case 'MS':
        setMemory(currentVal);
        break;
    }
  };

  // Copy result
  const handleCopyResult = () => {
    const val = evaluatedResult || livePreview;
    if (val && val !== '0' && val !== 'Error') {
      navigator.clipboard.writeText(val);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // Global physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        insertToken(e.key);
      } else if (e.key === '.') {
        insertToken('.');
      } else if (e.key === '+') {
        insertToken('+');
      } else if (e.key === '-') {
        insertToken('-');
      } else if (e.key === '*') {
        insertToken('×');
      } else if (e.key === '/') {
        e.preventDefault();
        insertToken('÷');
      } else if (e.key === '^') {
        insertToken('^');
      } else if (e.key === '(' || e.key === ')') {
        insertToken(e.key);
      } else if (e.key === '%') {
        insertToken('%');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleCalculate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [insertToken, handleCalculate, handleDelete, handleClear]);

  // Quick action: send graph function to grapher
  const handlePlotFunction = (fnStr: string) => {
    setGraphFunc(fnStr);
    setActiveTab('graph');
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col select-none">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Apex AI Scientific Calculator
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  v3.8 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Precision Arithmetic · Calculus · Trig · Live Graphing · AI Math Solver
              </p>
            </div>
          </div>

          {/* Sound & Mode Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute sound clicks' : 'Enable tactile audio clicks'}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Quick workbench mobile toggle */}
            <div className="flex lg:hidden items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs font-medium">
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  activeTab === 'ai' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                AI
              </button>
              <button
                onClick={() => setActiveTab('graph')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  activeTab === 'graph' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Graph
              </button>
              <button
                onClick={() => setActiveTab('tape')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  activeTab === 'tape' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Tape
              </button>
              <button
                onClick={() => setActiveTab('units')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  activeTab === 'units' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Units
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main App Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Scientific Calculator Hardware Console (7 Cols on desktop) */}
        <section className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-slate-900/95 rounded-3xl border border-slate-800 shadow-2xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-xl">
            {/* Subtle glow background */}
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* DUAL-LINE HIGH-PRECISION DISPLAY */}
            <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-4 mb-4 relative shadow-inner">
              {/* Display Header / Mode Badges */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const nextMode: AngleMode =
                        angleMode === 'DEG' ? 'RAD' : angleMode === 'RAD' ? 'GRAD' : 'DEG';
                      setAngleMode(nextMode);
                      sound.playKeyClick();
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 hover:border-cyan-500 text-cyan-300 font-bold transition"
                  >
                    {angleMode}
                  </button>

                  {memory !== 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-400 text-[11px] font-bold">
                      M = {formatNumber(memory)}
                    </span>
                  )}
                  {isSecond && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700/60 text-amber-400 text-[11px] font-bold">
                      2nd
                    </span>
                  )}
                  {isHyp && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-700/60 text-purple-400 text-[11px] font-bold">
                      HYP
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyResult}
                    title="Copy Result"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (expression) {
                        setGraphFunc(expression);
                        setActiveTab('graph');
                      }
                    }}
                    title="Plot this expression in Grapher"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded transition"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    title="Explain with AI"
                    className="px-2 py-0.5 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    AI Explain
                  </button>
                </div>
              </div>

              {/* Upper Line: Current Expression Input */}
              <div className="pt-3 pb-1 min-h-[44px] flex items-center justify-end overflow-x-auto no-scrollbar font-mono text-xl sm:text-2xl text-slate-200 tracking-wider">
                {expression ? (
                  <span className="whitespace-nowrap">{expression}</span>
                ) : (
                  <span className="text-slate-600">0</span>
                )}
              </div>

              {/* Lower Line: Live Result or Final Evaluated Result */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-right">
                <span className="text-[11px] font-mono text-slate-500">
                  {evaluatedResult !== null ? 'Result' : 'Preview'}
                </span>
                <div
                  className={`font-mono font-bold tracking-tight truncate max-w-full ${
                    evaluatedResult !== null
                      ? 'text-2xl sm:text-3xl text-emerald-400'
                      : 'text-xl sm:text-2xl text-cyan-400/80'
                  }`}
                >
                  = {evaluatedResult !== null ? evaluatedResult : livePreview || '0'}
                </div>
              </div>
            </div>

            {/* KEYPAD CONSOLE */}
            <div className="space-y-2">
              {/* Row 0: Memory & Mode Function Bar */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-xs font-mono">
                <button
                  onClick={() => setIsSecond(!isSecond)}
                  className={`py-2 rounded-xl font-bold transition active:scale-95 border ${
                    isSecond
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 border-slate-700/60'
                  }`}
                >
                  2nd
                </button>
                <button
                  onClick={() => setIsHyp(!isHyp)}
                  className={`py-2 rounded-xl font-bold transition active:scale-95 border ${
                    isHyp
                      ? 'bg-purple-500 text-slate-950 border-purple-400'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-purple-300 border-slate-700/60'
                  }`}
                >
                  hyp
                </button>
                <button
                  onClick={() => handleMemory('MC')}
                  className="py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition active:scale-95"
                >
                  MC
                </button>
                <button
                  onClick={() => handleMemory('MR')}
                  className="py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition active:scale-95"
                >
                  MR
                </button>
                <button
                  onClick={() => handleMemory('M+')}
                  className="py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition active:scale-95"
                >
                  M+
                </button>
                <button
                  onClick={() => handleMemory('M-')}
                  className="py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition active:scale-95"
                >
                  M-
                </button>
                <button
                  onClick={() => handleMemory('MS')}
                  className="py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition active:scale-95"
                >
                  MS
                </button>
              </div>

              {/* Row 1: Trigonometric & Constants */}
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 sm:gap-2 text-xs font-mono">
                <button
                  onClick={() =>
                    insertFunc(isHyp ? (isSecond ? 'asinh' : 'sinh') : isSecond ? 'asin' : 'sin')
                  }
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isHyp ? (isSecond ? 'sinh⁻¹' : 'sinh') : isSecond ? 'sin⁻¹' : 'sin'}
                </button>
                <button
                  onClick={() =>
                    insertFunc(isHyp ? (isSecond ? 'acosh' : 'cosh') : isSecond ? 'acos' : 'cos')
                  }
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isHyp ? (isSecond ? 'cosh⁻¹' : 'cosh') : isSecond ? 'cos⁻¹' : 'cos'}
                </button>
                <button
                  onClick={() =>
                    insertFunc(isHyp ? (isSecond ? 'atanh' : 'tanh') : isSecond ? 'atan' : 'tan')
                  }
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isHyp ? (isSecond ? 'tanh⁻¹' : 'tanh') : isSecond ? 'tan⁻¹' : 'tan'}
                </button>
                <button
                  onClick={() => insertToken('π')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95 font-serif"
                >
                  π
                </button>
                <button
                  onClick={() => insertToken('e')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95 font-serif"
                >
                  e
                </button>
                <button
                  onClick={() => insertToken('(')}
                  className="py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  (
                </button>
                <button
                  onClick={() => insertToken(')')}
                  className="py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  )
                </button>
              </div>

              {/* Row 2: Powers, Roots, Logs, Factorial */}
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 sm:gap-2 text-xs font-mono">
                <button
                  onClick={() => (isSecond ? insertFunc('cbrt') : insertFunc('sqrt'))}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isSecond ? '∛x' : '√x'}
                </button>
                <button
                  onClick={() => (isSecond ? insertToken('^3') : insertToken('^2'))}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isSecond ? 'x³' : 'x²'}
                </button>
                <button
                  onClick={() => insertToken('^')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  xʸ
                </button>
                <button
                  onClick={() => (isSecond ? insertToken('10^') : insertFunc('log'))}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isSecond ? '10ˣ' : 'log'}
                </button>
                <button
                  onClick={() => (isSecond ? insertToken('e^') : insertFunc('ln'))}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isSecond ? 'eˣ' : 'ln'}
                </button>
                <button
                  onClick={() => insertToken('!')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  x!
                </button>
                <button
                  onClick={() => insertToken('%')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  %
                </button>
              </div>

              {/* Row 3: Abs, Reciprocal, nCr, Mod */}
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 sm:gap-2 text-xs font-mono">
                <button
                  onClick={() => insertFunc('abs')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  |x|
                </button>
                <button
                  onClick={() => insertToken('^(-1)')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  1/x
                </button>
                <button
                  onClick={() => insertToken(isSecond ? ' nPr ' : ' nCr ')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  {isSecond ? 'nPr' : 'nCr'}
                </button>
                <button
                  onClick={() => insertToken(' mod ')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  mod
                </button>
                <button
                  onClick={() => insertFunc('round')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition active:scale-95"
                >
                  rnd
                </button>
                <button
                  onClick={() => insertToken('x')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700/60 transition active:scale-95 font-bold"
                >
                  x
                </button>
                <button
                  onClick={() => insertToken(lastAnswer !== '0' ? lastAnswer : '0')}
                  className="py-2 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 rounded-xl border border-slate-700/60 transition active:scale-95 font-semibold"
                >
                  Ans
                </button>
              </div>

              {/* MAIN NUMERIC & BASIC OPERATOR KEYPAD */}
              <div className="pt-2 grid grid-cols-4 gap-2 sm:gap-2.5 font-mono text-lg font-semibold">
                {/* Row 1: AC, DEL, (±), ÷ */}
                <button
                  onClick={handleClear}
                  className="py-3.5 bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-2xl transition active:scale-95 font-bold"
                >
                  AC
                </button>
                <button
                  onClick={handleDelete}
                  className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-2xl transition active:scale-95 flex items-center justify-center"
                >
                  <Delete className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNegate}
                  className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  ±
                </button>
                <button
                  onClick={() => insertToken('÷')}
                  className="py-3.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded-2xl transition active:scale-95 font-bold text-xl flex items-center justify-center"
                >
                  <Divide className="w-5 h-5" />
                </button>

                {/* Row 2: 7, 8, 9, × */}
                <button
                  onClick={() => insertToken('7')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  7
                </button>
                <button
                  onClick={() => insertToken('8')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  8
                </button>
                <button
                  onClick={() => insertToken('9')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  9
                </button>
                <button
                  onClick={() => insertToken('×')}
                  className="py-3.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded-2xl transition active:scale-95 font-bold text-xl flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Row 3: 4, 5, 6, - */}
                <button
                  onClick={() => insertToken('4')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  4
                </button>
                <button
                  onClick={() => insertToken('5')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  5
                </button>
                <button
                  onClick={() => insertToken('6')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  6
                </button>
                <button
                  onClick={() => insertToken('-')}
                  className="py-3.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded-2xl transition active:scale-95 font-bold text-xl flex items-center justify-center"
                >
                  <Minus className="w-5 h-5" />
                </button>

                {/* Row 4: 1, 2, 3, + */}
                <button
                  onClick={() => insertToken('1')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  1
                </button>
                <button
                  onClick={() => insertToken('2')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  2
                </button>
                <button
                  onClick={() => insertToken('3')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  3
                </button>
                <button
                  onClick={() => insertToken('+')}
                  className="py-3.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded-2xl transition active:scale-95 font-bold text-xl flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* Row 5: 0, ., EXP, = */}
                <button
                  onClick={() => insertToken('0')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={() => insertToken('.')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60 rounded-2xl transition active:scale-95"
                >
                  .
                </button>
                <button
                  onClick={() => insertToken('e')}
                  className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-2xl transition active:scale-95 text-base font-bold"
                  title="Scientific notation exponent (e.g. 1.5e6)"
                >
                  EXP
                </button>
                <button
                  onClick={handleCalculate}
                  className="py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-2xl border border-emerald-400 shadow-lg shadow-emerald-500/25 transition active:scale-95 text-2xl flex items-center justify-center"
                >
                  <Equal className="w-6 h-6 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Multi-tool Workbench (AI Math Intelligence, Grapher, Tape, Units) */}
        <section className="lg:col-span-5 flex flex-col space-y-3">
          {/* Navigation Bar Tabs */}
          <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-medium">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Tutor</span>
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'graph'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Graph f(x)</span>
            </button>
            <button
              onClick={() => setActiveTab('tape')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'tape'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
            <button
              onClick={() => setActiveTab('units')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'units'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Units</span>
            </button>
          </div>

          {/* Workbench Display Container */}
          <div className="min-h-[580px] flex-1">
            {activeTab === 'ai' && (
              <AiSolverDrawer
                currentExpression={expression}
                currentResult={evaluatedResult || livePreview}
                angleMode={angleMode}
                onApplyExpression={(expr) => {
                  setExpression(expr);
                  sound.playKeyClick();
                }}
                onPlotFunction={handlePlotFunction}
              />
            )}

            {activeTab === 'graph' && (
              <GraphPlotter
                initialFunction={graphFunc}
                angleMode={angleMode}
                onInsertToCalc={(expr) => {
                  setExpression(expr);
                  sound.playKeyClick();
                }}
              />
            )}

            {activeTab === 'tape' && (
              <HistoryTape
                history={history}
                onClearHistory={() => setHistory([])}
                onReuseExpression={(expr) => {
                  setExpression(expr);
                  sound.playKeyClick();
                }}
                onInsertResult={(res) => {
                  insertToken(res);
                }}
                onExplainItem={(item) => {
                  setExpression(item.expression);
                  setEvaluatedResult(item.result);
                  setActiveTab('ai');
                }}
              />
            )}

            {activeTab === 'units' && (
              <UnitConverter
                onInsertToCalc={(val) => {
                  insertToken(val);
                }}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-2.5 px-4 text-center text-xs text-slate-500 font-mono">
        Apex AI Scientific Calculator · Keyboard shortcuts supported: Digits, +, -, *, /, ^, %, Enter, Backspace, Esc
      </footer>
    </div>
  );
}
