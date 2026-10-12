/**
 * Apex Precision Scientific Math Engine
 * Supports standard arithmetic, advanced scientific/trigonometric/hyperbolic functions,
 * combinations, permutations, angle modes (DEG, RAD, GRAD), and floating-point sanitation.
 */

export type AngleMode = 'DEG' | 'RAD' | 'GRAD';

export interface EvalResult {
  success: boolean;
  value: number;
  formatted: string;
  fraction?: string;
  scientific?: string;
  error?: string;
}

// Factorial helper
function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('Factorial requires a non-negative integer');
  }
  if (n > 170) {
    return Infinity; // JS Number max is ~1.79e308
  }
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

// Combinations: nCr = n! / (r! * (n - r)!)
function combinations(n: number, r: number): number {
  if (r < 0 || n < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) {
    throw new Error('nCr requires integers where 0 <= r <= n');
  }
  if (r === 0 || r === n) return 1;
  if (r > n / 2) r = n - r;
  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return Math.round(res);
}

// Permutations: nPr = n! / (n - r)!
function permutations(n: number, r: number): number {
  if (r < 0 || n < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) {
    throw new Error('nPr requires integers where 0 <= r <= n');
  }
  let res = 1;
  for (let i = 0; i < r; i++) {
    res *= (n - i);
  }
  return Math.round(res);
}

// Angle conversion to Radians
function toRadians(val: number, mode: AngleMode): number {
  if (mode === 'DEG') return (val * Math.PI) / 180;
  if (mode === 'GRAD') return (val * Math.PI) / 200;
  return val;
}

// Angle conversion from Radians
function fromRadians(val: number, mode: AngleMode): number {
  if (mode === 'DEG') return (val * 180) / Math.PI;
  if (mode === 'GRAD') return (val * 200) / Math.PI;
  return val;
}

// Convert decimal to simplified fraction (e.g. 0.75 -> "3/4")
export function decimalToFraction(val: number, tolerance = 1e-7): string | undefined {
  if (!Number.isFinite(val) || Math.abs(val) > 1000000) return undefined;
  if (Number.isInteger(val)) return undefined;

  const sign = val < 0 ? -1 : 1;
  const x = Math.abs(val);

  let h1 = 1, h2 = 0;
  let k1 = 0, k2 = 1;
  let b = x;

  do {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;

    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;

    b = 1 / (b - a);
  } while (Math.abs(x - h1 / k1) > x * tolerance && k1 < 10000);

  if (k1 === 1 || k1 > 10000) return undefined;

  const num = sign * h1;
  return `${num}/${k1}`;
}

// Format numbers nicely, avoiding 0.30000000000000004
export function formatNumber(val: number, maxDecimals = 10): string {
  if (Number.isNaN(val)) return 'Error: Undefined';
  if (val === Infinity) return 'Infinity';
  if (val === -Infinity) return '-Infinity';
  if (Object.is(val, -0)) return '0';

  // If very large or very small (non-zero)
  const abs = Math.abs(val);
  if (abs !== 0 && (abs >= 1e14 || abs < 1e-9)) {
    return val.toExponential(8).replace(/\.?0+e/, 'e');
  }

  // Round to maxDecimals to remove JS float glitches
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(val * factor) / factor;
  return rounded.toString();
}

/**
 * Normalizes user mathematical input into clean parseable tokens
 */
export function sanitizeExpression(expr: string): string {
  let s = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√([0-9a-zA-Z.]+)/g, 'sqrt($1)')
    .replace(/∛\(/g, 'cbrt(')
    .replace(/∛([0-9a-zA-Z.]+)/g, 'cbrt($1)')
    .replace(/sin⁻¹/g, 'asin')
    .replace(/cos⁻¹/g, 'acos')
    .replace(/tan⁻¹/g, 'atan')
    .replace(/sinh⁻¹/g, 'asinh')
    .replace(/cosh⁻¹/g, 'acosh')
    .replace(/tanh⁻¹/g, 'atanh')
    .replace(/ln\(/g, 'ln(')
    .replace(/log₁₀\(/g, 'log(')
    .replace(/log\(/g, 'log(')
    .replace(/%/g, '*(0.01)');

  // Implicit multiplication: e.g. 2pi -> 2*pi, 3(4) -> 3*(4), (2)(3) -> (2)*(3), 4sqrt(5) -> 4*sqrt(5)
  // Number followed by constant or func or '('
  s = s.replace(/(\d+)(\s*)([a-zA-Z(])/g, '$1*$3');
  // ')' followed by '(' or number or letter
  s = s.replace(/\)(\s*)([\d(a-zA-Z])/g, ')*$2');
  // 'pi' or 'e' followed by '(' or number
  s = s.replace(/(pi|e|phi)(\s*)([\d(a-zA-Z])/g, '$1*$3');

  return s;
}

/**
 * Tokenizer & Shunting-Yard Recursive Evaluator
 */
type TokenType = 'NUMBER' | 'OP' | 'FUNC' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'VAR';

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS: Record<string, { precedence: number; assoc: 'L' | 'R' }> = {
  '+': { precedence: 1, assoc: 'L' },
  '-': { precedence: 1, assoc: 'L' },
  '*': { precedence: 2, assoc: 'L' },
  '/': { precedence: 2, assoc: 'L' },
  'mod': { precedence: 2, assoc: 'L' },
  '^': { precedence: 3, assoc: 'R' },
  'nCr': { precedence: 2, assoc: 'L' },
  'nPr': { precedence: 2, assoc: 'L' },
  '!': { precedence: 4, assoc: 'L' }, // postfix factorial
};

const KNOWN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'cot', 'sec', 'csc',
  'sqrt', 'cbrt', 'log', 'log10', 'ln', 'log2',
  'exp', 'abs', 'ceil', 'floor', 'round', 'sign', 'fact'
]);

export function tokenize(rawExpr: string): Token[] {
  const expr = sanitizeExpression(rawExpr);
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including scientific notation like 1e5 or 2.3e-4)
    if (/[0-9]/.test(char) || (char === '.' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
        const nextChar = expr[i + 1];
        if (/[0-9]/.test(nextChar) || nextChar === '+' || nextChar === '-') {
          numStr += expr[i];
          i++;
          if (expr[i] === '+' || expr[i] === '-') {
            numStr += expr[i];
            i++;
          }
          while (i < expr.length && /[0-9]/.test(expr[i])) {
            numStr += expr[i];
            i++;
          }
        }
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Identifiers (functions, constants, variables like 'x')
    if (/[a-zA-Z_]/.test(char)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i];
        i++;
      }

      const lower = id.toLowerCase();
      if (lower === 'pi') {
        tokens.push({ type: 'NUMBER', value: Math.PI.toString() });
      } else if (lower === 'e') {
        tokens.push({ type: 'NUMBER', value: Math.E.toString() });
      } else if (lower === 'phi') {
        tokens.push({ type: 'NUMBER', value: '1.618033988749895' });
      } else if (lower === 'x') {
        tokens.push({ type: 'VAR', value: 'x' });
      } else if (lower === 'mod' || lower === 'ncr' || lower === 'npr') {
        tokens.push({ type: 'OP', value: lower === 'ncr' ? 'nCr' : lower === 'npr' ? 'nPr' : 'mod' });
      } else if (KNOWN_FUNCTIONS.has(lower)) {
        tokens.push({ type: 'FUNC', value: lower });
      } else {
        // Unknown symbol, try treating as variable or function
        tokens.push({ type: 'FUNC', value: lower });
      }
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Comma (function arg separator)
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Factorial postfix '!'
    if (char === '!') {
      tokens.push({ type: 'OP', value: '!' });
      i++;
      continue;
    }

    // Unary minus vs Binary minus
    if (char === '-') {
      const prev = tokens[tokens.length - 1];
      const isUnary = !prev || prev.type === 'OP' || prev.type === 'LPAREN' || prev.type === 'COMMA';
      if (isUnary) {
        // Unary minus: push 0 and '-' or parse next number directly
        tokens.push({ type: 'NUMBER', value: '0' });
        tokens.push({ type: 'OP', value: '-' });
        i++;
        continue;
      }
    }

    // Operators: +, -, *, /, ^
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^') {
      tokens.push({ type: 'OP', value: char });
      i++;
      continue;
    }

    // Fallback advance
    i++;
  }

  return tokens;
}

/**
 * Shunting-Yard to convert infix tokens to Reverse Polish Notation (RPN)
 */
function toRPN(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'NUMBER' || token.type === 'VAR') {
      output.push(token);
    } else if (token.type === 'FUNC') {
      opStack.push(token);
    } else if (token.type === 'COMMA') {
      while (opStack.length && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
    } else if (token.type === 'OP') {
      const o1 = token.value;
      const op1Info = OPERATORS[o1];

      while (opStack.length) {
        const top = opStack[opStack.length - 1];
        if (top.type === 'OP') {
          const o2 = top.value;
          const op2Info = OPERATORS[o2];
          if (
            (op1Info?.assoc === 'L' && op1Info.precedence <= op2Info.precedence) ||
            (op1Info?.assoc === 'R' && op1Info.precedence < op2Info.precedence)
          ) {
            output.push(opStack.pop()!);
            continue;
          }
        }
        break;
      }
      opStack.push(token);
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
      if (opStack.length && opStack[opStack.length - 1].type === 'LPAREN') {
        opStack.pop(); // discard '('
      }
      if (opStack.length && opStack[opStack.length - 1].type === 'FUNC') {
        output.push(opStack.pop()!);
      }
    }
  }

  while (opStack.length) {
    const top = opStack.pop()!;
    if (top.type === 'LPAREN' || top.type === 'RPAREN') {
      throw new Error('Mismatched parentheses');
    }
    output.push(top);
  }

  return output;
}

/**
 * Evaluates an RPN token list
 */
function evaluateRPN(rpn: Token[], angleMode: AngleMode, varX = 0): number {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === 'NUMBER') {
      stack.push(parseFloat(token.value));
    } else if (token.type === 'VAR') {
      stack.push(varX);
    } else if (token.type === 'OP') {
      if (token.value === '!') {
        if (stack.length < 1) throw new Error('Missing operand for factorial');
        const a = stack.pop()!;
        stack.push(factorial(a));
        continue;
      }

      if (stack.length < 2) {
        throw new Error(`Missing operands for operator '${token.value}'`);
      }
      const b = stack.pop()!;
      const a = stack.pop()!;

      switch (token.value) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b);
          break;
        case 'mod':
          if (b === 0) throw new Error('Modulo by zero');
          stack.push(a % b);
          break;
        case '^':
          stack.push(Math.pow(a, b));
          break;
        case 'nCr':
          stack.push(combinations(a, b));
          break;
        case 'nPr':
          stack.push(permutations(a, b));
          break;
        default:
          throw new Error(`Unknown operator: ${token.value}`);
      }
    } else if (token.type === 'FUNC') {
      if (stack.length < 1) {
        throw new Error(`Missing argument for function '${token.value}'`);
      }
      const arg = stack.pop()!;
      const fn = token.value.toLowerCase();

      switch (fn) {
        case 'sin': {
          const rad = toRadians(arg, angleMode);
          // Fix precision for sin(180) or sin(pi)
          const s = Math.sin(rad);
          stack.push(Math.abs(s) < 1e-15 ? 0 : s);
          break;
        }
        case 'cos': {
          const rad = toRadians(arg, angleMode);
          const c = Math.cos(rad);
          stack.push(Math.abs(c) < 1e-15 ? 0 : c);
          break;
        }
        case 'tan': {
          const rad = toRadians(arg, angleMode);
          const c = Math.cos(rad);
          if (Math.abs(c) < 1e-15) throw new Error('Tangent undefined (cos = 0)');
          const t = Math.tan(rad);
          stack.push(Math.abs(t) < 1e-15 ? 0 : t);
          break;
        }
        case 'cot': {
          const rad = toRadians(arg, angleMode);
          const s = Math.sin(rad);
          if (Math.abs(s) < 1e-15) throw new Error('Cotangent undefined');
          stack.push(1 / Math.tan(rad));
          break;
        }
        case 'sec': {
          const rad = toRadians(arg, angleMode);
          const c = Math.cos(rad);
          if (Math.abs(c) < 1e-15) throw new Error('Secant undefined');
          stack.push(1 / c);
          break;
        }
        case 'csc': {
          const rad = toRadians(arg, angleMode);
          const s = Math.sin(rad);
          if (Math.abs(s) < 1e-15) throw new Error('Cosecant undefined');
          stack.push(1 / s);
          break;
        }
        case 'asin': {
          if (arg < -1 || arg > 1) throw new Error('asin domain error [-1, 1]');
          stack.push(fromRadians(Math.asin(arg), angleMode));
          break;
        }
        case 'acos': {
          if (arg < -1 || arg > 1) throw new Error('acos domain error [-1, 1]');
          stack.push(fromRadians(Math.acos(arg), angleMode));
          break;
        }
        case 'atan': {
          stack.push(fromRadians(Math.atan(arg), angleMode));
          break;
        }
        case 'sinh':
          stack.push(Math.sinh(arg));
          break;
        case 'cosh':
          stack.push(Math.cosh(arg));
          break;
        case 'tanh':
          stack.push(Math.tanh(arg));
          break;
        case 'asinh':
          stack.push(Math.asinh(arg));
          break;
        case 'acosh':
          if (arg < 1) throw new Error('acosh domain error [1, ∞)');
          stack.push(Math.acosh(arg));
          break;
        case 'atanh':
          if (arg <= -1 || arg >= 1) throw new Error('atanh domain error (-1, 1)');
          stack.push(Math.atanh(arg));
          break;
        case 'sqrt':
          if (arg < 0) throw new Error('Square root of negative number');
          stack.push(Math.sqrt(arg));
          break;
        case 'cbrt':
          stack.push(Math.cbrt(arg));
          break;
        case 'log':
        case 'log10':
          if (arg <= 0) throw new Error('Logarithm of non-positive number');
          stack.push(Math.log10(arg));
          break;
        case 'ln':
          if (arg <= 0) throw new Error('Natural log of non-positive number');
          stack.push(Math.log(arg));
          break;
        case 'log2':
          if (arg <= 0) throw new Error('Log2 of non-positive number');
          stack.push(Math.log2(arg));
          break;
        case 'exp':
          stack.push(Math.exp(arg));
          break;
        case 'abs':
          stack.push(Math.abs(arg));
          break;
        case 'ceil':
          stack.push(Math.ceil(arg));
          break;
        case 'floor':
          stack.push(Math.floor(arg));
          break;
        case 'round':
          stack.push(Math.round(arg));
          break;
        case 'sign':
          stack.push(Math.sign(arg));
          break;
        case 'fact':
          stack.push(factorial(arg));
          break;
        default:
          throw new Error(`Unsupported function: ${token.value}`);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error('Invalid expression syntax');
  }

  return stack[0];
}

/**
 * Main Evaluation API
 */
export function evaluateMath(expr: string, angleMode: AngleMode = 'DEG'): EvalResult {
  if (!expr || !expr.trim()) {
    return { success: false, value: 0, formatted: '0', error: 'Empty expression' };
  }

  try {
    const tokens = tokenize(expr);
    if (!tokens.length) {
      return { success: false, value: 0, formatted: '0', error: 'Empty expression' };
    }

    const rpn = toRPN(tokens);
    const num = evaluateRPN(rpn, angleMode);

    if (!Number.isFinite(num)) {
      return {
        success: false,
        value: num,
        formatted: num.toString(),
        error: Number.isNaN(num) ? 'Undefined' : 'Overflow / Infinity',
      };
    }

    const formatted = formatNumber(num);
    const fraction = decimalToFraction(num);
    const scientific = num.toExponential(6);

    return {
      success: true,
      value: num,
      formatted,
      fraction,
      scientific,
    };
  } catch (err: any) {
    return {
      success: false,
      value: NaN,
      formatted: 'Error',
      error: err.message || 'Syntax Error',
    };
  }
}

/**
 * Evaluates function f(x) for graphing
 */
export function evaluateFunctionAtX(expr: string, x: number, angleMode: AngleMode = 'RAD'): number {
  try {
    const tokens = tokenize(expr);
    const rpn = toRPN(tokens);
    return evaluateRPN(rpn, angleMode, x);
  } catch {
    return NaN;
  }
}
