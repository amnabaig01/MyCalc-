import React, { useState } from 'react';
import { ArrowRightLeft, Sparkles } from 'lucide-react';

interface UnitConverterProps {
  onInsertToCalc: (val: string) => void;
}

type Category = 'length' | 'mass' | 'temp' | 'speed' | 'angle' | 'energy' | 'pressure' | 'data';

interface UnitDef {
  label: string;
  factor: number; // relative to base unit
  toBase?: (val: number) => number;
  fromBase?: (val: number) => number;
}

const CATEGORIES: Record<Category, { name: string; units: Record<string, UnitDef>; defaultFrom: string; defaultTo: string }> = {
  length: {
    name: 'Length',
    defaultFrom: 'm',
    defaultTo: 'ft',
    units: {
      m: { label: 'Meters (m)', factor: 1 },
      km: { label: 'Kilometers (km)', factor: 1000 },
      cm: { label: 'Centimeters (cm)', factor: 0.01 },
      mm: { label: 'Millimeters (mm)', factor: 0.001 },
      mi: { label: 'Miles (mi)', factor: 1609.344 },
      yd: { label: 'Yards (yd)', factor: 0.9144 },
      ft: { label: 'Feet (ft)', factor: 0.3048 },
      in: { label: 'Inches (in)', factor: 0.0254 },
      nm: { label: 'Nautical Miles', factor: 1852 },
    },
  },
  mass: {
    name: 'Mass & Weight',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    units: {
      kg: { label: 'Kilograms (kg)', factor: 1 },
      g: { label: 'Grams (g)', factor: 0.001 },
      mg: { label: 'Milligrams (mg)', factor: 0.000001 },
      lb: { label: 'Pounds (lb)', factor: 0.45359237 },
      oz: { label: 'Ounces (oz)', factor: 0.028349523 },
      ton: { label: 'Metric Tons (t)', factor: 1000 },
    },
  },
  temp: {
    name: 'Temperature',
    defaultFrom: 'c',
    defaultTo: 'f',
    units: {
      c: {
        label: 'Celsius (°C)',
        factor: 1,
        toBase: (v) => v,
        fromBase: (v) => v,
      },
      f: {
        label: 'Fahrenheit (°F)',
        factor: 1,
        toBase: (v) => ((v - 32) * 5) / 9,
        fromBase: (v) => (v * 9) / 5 + 32,
      },
      k: {
        label: 'Kelvin (K)',
        factor: 1,
        toBase: (v) => v - 273.15,
        fromBase: (v) => v + 273.15,
      },
    },
  },
  speed: {
    name: 'Speed',
    defaultFrom: 'kmh',
    defaultTo: 'mph',
    units: {
      ms: { label: 'Meters / sec (m/s)', factor: 1 },
      kmh: { label: 'Kilometers / hr (km/h)', factor: 0.277778 },
      mph: { label: 'Miles / hr (mph)', factor: 0.44704 },
      knot: { label: 'Knots (kn)', factor: 0.514444 },
    },
  },
  angle: {
    name: 'Angle',
    defaultFrom: 'deg',
    defaultTo: 'rad',
    units: {
      deg: { label: 'Degrees (°)', factor: 1 },
      rad: { label: 'Radians (rad)', factor: 180 / Math.PI },
      grad: { label: 'Gradians (grad)', factor: 0.9 },
      arcmin: { label: 'Arcminutes (\')', factor: 1 / 60 },
      arcsec: { label: 'Arcseconds (\'\')', factor: 1 / 3600 },
    },
  },
  energy: {
    name: 'Energy',
    defaultFrom: 'j',
    defaultTo: 'cal',
    units: {
      j: { label: 'Joules (J)', factor: 1 },
      kj: { label: 'Kilojoules (kJ)', factor: 1000 },
      cal: { label: 'Calories (cal)', factor: 4.184 },
      kcal: { label: 'Kilocalories (kcal)', factor: 4184 },
      wh: { label: 'Watt-hours (Wh)', factor: 3600 },
      kwh: { label: 'Kilowatt-hours (kWh)', factor: 3.6e6 },
      ev: { label: 'Electronvolts (eV)', factor: 1.602176634e-19 },
    },
  },
  pressure: {
    name: 'Pressure',
    defaultFrom: 'bar',
    defaultTo: 'psi',
    units: {
      pa: { label: 'Pascals (Pa)', factor: 1 },
      kpa: { label: 'Kilopascals (kPa)', factor: 1000 },
      bar: { label: 'Bars (bar)', factor: 100000 },
      psi: { label: 'Pound-force / sq in (psi)', factor: 6894.76 },
      atm: { label: 'Atmospheres (atm)', factor: 101325 },
      torr: { label: 'Torr / mmHg', factor: 133.322 },
    },
  },
  data: {
    name: 'Digital Storage',
    defaultFrom: 'gb',
    defaultTo: 'mb',
    units: {
      b: { label: 'Bytes (B)', factor: 1 },
      kb: { label: 'Kilobytes (KB)', factor: 1024 },
      mb: { label: 'Megabytes (MB)', factor: 1024 * 1024 },
      gb: { label: 'Gigabytes (GB)', factor: 1024 * 1024 * 1024 },
      tb: { label: 'Terabytes (TB)', factor: 1024 * 1024 * 1024 * 1024 },
    },
  },
};

export const UnitConverter: React.FC<UnitConverterProps> = ({ onInsertToCalc }) => {
  const [category, setCategory] = useState<Category>('length');
  const [inputValue, setInputValue] = useState('1');
  const [fromUnit, setFromUnit] = useState(CATEGORIES.length.defaultFrom);
  const [toUnit, setToUnit] = useState(CATEGORIES.length.defaultTo);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setFromUnit(CATEGORIES[cat].defaultFrom);
    setToUnit(CATEGORIES[cat].defaultTo);
  };

  const swapUnits = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  // Calculate output
  const currentCat = CATEGORIES[category];
  const uFrom = currentCat.units[fromUnit];
  const uTo = currentCat.units[toUnit];

  const num = parseFloat(inputValue);
  let result = 0;

  if (!isNaN(num) && uFrom && uTo) {
    if (category === 'temp') {
      const base = uFrom.toBase ? uFrom.toBase(num) : num * uFrom.factor;
      result = uTo.fromBase ? uTo.fromBase(base) : base / uTo.factor;
    } else {
      const base = num * uFrom.factor;
      result = base / uTo.factor;
    }
  }

  const formattedResult = isNaN(result)
    ? '0'
    : Math.abs(result) < 1e-4 || Math.abs(result) >= 1e8
    ? result.toExponential(6)
    : Number(result.toFixed(6)).toString();

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl p-4 space-y-4">
      {/* Category selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {(Object.keys(CATEGORIES) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition font-medium ${
              category === cat
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            {CATEGORIES[cat].name}
          </button>
        ))}
      </div>

      {/* Converter Body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
        {/* From Section */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-medium">From</label>
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-lg font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
          <select
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none"
          >
            {Object.entries(currentCat.units).map(([key, def]) => (
              <option key={key} value={key}>
                {def.label}
              </option>
            ))}
          </select>
        </div>

        {/* Swap button on mobile or middle */}
        <div className="flex md:hidden justify-center">
          <button
            onClick={swapUnits}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-cyan-400 transition"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>

        {/* To Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400 font-medium">To (Result)</label>
            <button
              onClick={swapUnits}
              className="hidden md:flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
            >
              <ArrowRightLeft className="w-3 h-3" /> Swap
            </button>
          </div>
          <div className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-lg font-mono font-bold text-emerald-400 truncate">
            {formattedResult}
          </div>
          <select
            value={toUnit}
            onChange={(e) => setToUnit(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none"
          >
            {Object.entries(currentCat.units).map(([key, def]) => (
              <option key={key} value={key}>
                {def.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Insert into Calculator action */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-500 font-mono">
          1 {uFrom?.label.split(' ')[0]} = {(
            category === 'temp'
              ? (uTo?.fromBase?.(uFrom?.toBase?.(1) ?? 1) ?? 1)
              : (uFrom?.factor / uTo?.factor)
          ).toFixed(4)} {uTo?.label.split(' ')[0]}
        </span>
        <button
          onClick={() => onInsertToCalc(formattedResult)}
          className="px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Use {formattedResult} in Calculator
        </button>
      </div>
    </div>
  );
};
