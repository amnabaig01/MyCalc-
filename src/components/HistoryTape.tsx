import React, { useState } from 'react';
import {
  Clock,
  Trash2,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  PlusCircle,
} from 'lucide-react';

export interface HistoryItem {
  id: string;
  timestamp: Date;
  expression: string;
  result: string;
  fraction?: string;
  angleMode: string;
}

interface HistoryTapeProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  onReuseExpression: (expr: string) => void;
  onInsertResult: (res: string) => void;
  onExplainItem: (item: HistoryItem) => void;
}

export const HistoryTape: React.FC<HistoryTapeProps> = ({
  history,
  onClearHistory,
  onReuseExpression,
  onInsertResult,
  onExplainItem,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportHistory = () => {
    if (!history.length) return;
    const lines = history.map(
      (h) => `[${h.timestamp.toLocaleTimeString()}] ${h.expression} = ${h.result} (${h.angleMode})`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculator_tape_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold tracking-wide text-slate-200">
            Calculation Tape
          </span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {history.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <>
              <button
                onClick={exportHistory}
                title="Export History to Text"
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClearHistory}
                title="Clear Tape"
                className="p-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8 space-y-1">
            <Clock className="w-8 h-8 stroke-1 text-slate-600 mb-1" />
            <p className="font-medium text-slate-400">No calculations recorded yet</p>
            <p className="text-[11px] text-slate-600">Calculations will appear here</p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 rounded-xl transition space-y-1.5 group"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{item.timestamp.toLocaleTimeString()}</span>
                <span className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-[10px]">
                  {item.angleMode}
                </span>
              </div>

              {/* Expression */}
              <div
                onClick={() => onReuseExpression(item.expression)}
                title="Click to load expression"
                className="font-mono text-xs text-slate-300 hover:text-cyan-300 cursor-pointer truncate transition"
              >
                {item.expression}
              </div>

              {/* Result & Actions */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    = {item.result}
                  </span>
                  {item.fraction && (
                    <span className="text-[11px] font-mono text-cyan-400/80">
                      [{item.fraction}]
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => onExplainItem(item)}
                    title="Explain with AI"
                    className="p-1 hover:bg-indigo-950/50 text-indigo-400 hover:text-indigo-300 rounded transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onInsertResult(item.result)}
                    title="Insert result into calculator"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onReuseExpression(item.expression)}
                    title="Reuse formula"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(item.id, item.result)}
                    title="Copy result"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
