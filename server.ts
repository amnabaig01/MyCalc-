import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to generate content with fallback models and timeout
async function generateWithFallback(params: any, preferredModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'], timeoutMs = 7000) {
  let lastError: any = null;
  for (const model of preferredModels) {
    try {
      const callPromise = ai.models.generateContent({
        ...params,
        model,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timed out')), timeoutMs)
      );
      return (await Promise.race([callPromise, timeoutPromise])) as any;
    } catch (err: any) {
      console.warn(`Model ${model} attempt failed:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

// Local smart math solver fallback in case of transient API outage
function solveLocally(query: string, angleMode = 'DEG') {
  try {
    const lower = query.toLowerCase();

    // Hypotenuse check
    const hypMatch = lower.match(/hypotenuse.*?(\d+(?:\.\d+)?)\s*(?:and|,)\s*(\d+(?:\.\d+)?)/);
    if (hypMatch) {
      const a = parseFloat(hypMatch[1]);
      const b = parseFloat(hypMatch[2]);
      const c = Math.sqrt(a * a + b * b);
      return {
        expression: `sqrt(${a}^2 + ${b}^2)`,
        numericResult: c.toFixed(4).replace(/\.?0+$/, ''),
        exactResult: `√(${a * a + b * b})`,
        summary: `For right triangle with legs ${a} and ${b}, hypotenuse c = ${c.toFixed(4).replace(/\.?0+$/, '')}.`,
        steps: [
          {
            stepNumber: 1,
            title: 'Apply Pythagorean Theorem',
            explanation: 'The theorem states that a² + b² = c², so c = √(a² + b²).',
            math: `c = √(${a}² + ${b}²)`,
          },
          {
            stepNumber: 2,
            title: 'Compute squares of the legs',
            explanation: `${a}² = ${a * a} and ${b}² = ${b * b}.`,
            math: `${a * a} + ${b * b} = ${a * a + b * b}`,
          },
          {
            stepNumber: 3,
            title: 'Extract square root',
            explanation: `Calculate √(${a * a + b * b}) to determine the final length.`,
            math: `c = ${c.toFixed(4).replace(/\.?0+$/, '')}`,
          },
        ],
        formulaUsed: 'Pythagorean Theorem: a² + b² = c²',
        graphableFunction: null,
        units: 'units',
      };
    }

    // Circle Area
    const circleMatch = lower.match(/(?:circle|radius)\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)/);
    if (circleMatch && (lower.includes('area') || lower.includes('volume') || lower.includes('circumference'))) {
      const r = parseFloat(circleMatch[1]);
      if (lower.includes('area')) {
        const area = Math.PI * r * r;
        return {
          expression: `pi * ${r}^2`,
          numericResult: area.toFixed(4).replace(/\.?0+$/, ''),
          exactResult: `${r * r}π`,
          summary: `The area of a circle with radius ${r} is approximately ${area.toFixed(4).replace(/\.?0+$/, '')}.`,
          steps: [
            {
              stepNumber: 1,
              title: 'Identify Formula for Circle Area',
              explanation: 'Area is given by A = π × r².',
              math: `A = π × ${r}²`,
            },
            {
              stepNumber: 2,
              title: 'Square the Radius',
              explanation: `${r}² = ${r * r}.`,
              math: `A = ${r * r}π`,
            },
            {
              stepNumber: 3,
              title: 'Multiply by π',
              explanation: `Evaluate numerical approximation using π ≈ 3.14159.`,
              math: `A ≈ ${area.toFixed(4).replace(/\.?0+$/, '')}`,
            },
          ],
          formulaUsed: 'Circle Area: A = πr²',
          graphableFunction: null,
          units: 'sq units',
        };
      }
    }

    // Clean arithmetic
    let clean = query
      .replace(/calculate|solve|what is|find|evaluate/gi, '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .trim();

    // Evaluate basic arithmetic
    const sanitized = clean.replace(/[^0-9+\-*/().^%]/g, '').replace(/\^/g, '**');
    if (sanitized) {
      const res = Function(`"use strict"; return (${sanitized})`)();
      if (typeof res === 'number' && !isNaN(res)) {
        return {
          expression: clean,
          numericResult: res.toString(),
          exactResult: res.toString(),
          summary: `The calculated result is ${res}.`,
          steps: [
            {
              stepNumber: 1,
              title: 'Identify Arithmetic Expression',
              explanation: `Parsed expression: ${clean}`,
              math: clean,
            },
            {
              stepNumber: 2,
              title: 'Apply Order of Operations (PEMDAS)',
              explanation: 'Evaluate expressions inside parentheses, followed by exponents, multiplication/division, then addition/subtraction.',
              math: `Result = ${res}`,
            },
          ],
          formulaUsed: 'Standard Arithmetic / PEMDAS Precedence',
          graphableFunction: null,
          units: '',
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// AI Step-by-Step Problem Solver
app.post('/api/ai/solve', async (req, res) => {
  console.log('Received solve request:', req.body);
  const { query, angleMode = 'DEG' } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    const prompt = `You are an expert AI mathematician and scientific computation engine.
The user submitted this math problem or calculation request: "${query.trim()}".
Angle mode setting is: ${angleMode} (Degrees / Radians).

Please analyze and solve the problem step-by-step.
Return a structured JSON with:
1. "expression": The cleaned mathematical expression in standard scientific calculator syntax (e.g. "sin(45) * sqrt(16) + 2^3", "(2 * 10^5) / (4 * 10^2)").
2. "numericResult": The calculated numerical value as a string (with reasonable precision up to 10 decimal digits, or scientific notation if very large/small).
3. "exactResult": The exact mathematical form if applicable (e.g. "√2/2", "3π/4", "5/8", or same as numeric).
4. "summary": A concise 1-sentence answer to the user's prompt.
5. "steps": An array of steps explaining how to solve it. Each step must have:
   - "stepNumber": integer
   - "title": short title (e.g. "Identify the formula", "Apply Order of Operations", "Evaluate Trigonometric Value")
   - "explanation": clear plain-text explanation of what was done
   - "math": the mathematical expression at this stage
6. "formulaUsed": Any named formula or theorem used (e.g. "Pythagorean Theorem: a² + b² = c²", "Compound Interest: A = P(1 + r/n)^(nt)", or "Order of Operations PEMDAS").
7. "graphableFunction": If the problem involves an algebraic function or equation with x (e.g. "f(x) = x^2 - 4", "sin(x)"), provide the clean expression in terms of x suitable for plotting (e.g. "x^2 - 4"). Otherwise null.
8. "units": Any relevant measurement units if this was a physics/real-world problem (e.g. "m/s", "cm²", "USD", or empty string).`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expression: { type: Type.STRING },
            numericResult: { type: Type.STRING },
            exactResult: { type: Type.STRING },
            summary: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  math: { type: Type.STRING },
                },
                required: ['stepNumber', 'title', 'explanation', 'math'],
              },
            },
            formulaUsed: { type: Type.STRING },
            graphableFunction: { type: Type.STRING, nullable: true },
            units: { type: Type.STRING },
          },
          required: ['expression', 'numericResult', 'summary', 'steps'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.warn('AI solve error, attempting local fallback:', error?.message);
    const local = solveLocally(query);
    if (local) {
      return res.json(local);
    }
    return res.status(500).json({
      error: error?.message || 'Failed to solve mathematical query using AI.',
    });
  }
});

// AI Explanation of a Calculator Expression & Result
app.post('/api/ai/explain', async (req, res) => {
  const { expression, result, angleMode = 'DEG' } = req.body;
  if (!expression) {
    return res.status(400).json({ error: 'Expression is required.' });
  }

  try {
    const prompt = `The user evaluated the following arithmetic/scientific expression on their calculator:
Expression: "${expression}"
Result: "${result}"
Angle Mode: ${angleMode}

Provide an educational, clear explanation of how this result was calculated according to mathematical precedence (PEMDAS / BODMAS) and relevant mathematical rules (trigonometry, exponent rules, logarithms, factorial, etc.).

Return a structured JSON with:
1. "title": A descriptive title (e.g. "Evaluation of ${expression}")
2. "overview": A concise paragraph explaining the nature of the expression and the final answer.
3. "steps": An array of sequential intermediate calculations:
   - "step": Number (1, 2, 3...)
   - "subExpression": Part being computed
   - "rule": Mathematical rule or reason (e.g. "Evaluate parentheses first", "Compute trigonometric sin(30°)", "Perform division before addition")
   - "value": Resulting value after this step
4. "alternateRepresentations": Array of strings (e.g. scientific notation, fraction, percentage if applicable)
5. "mathematicalInsight": A neat tip, identity, or intuition related to this operation (e.g. "Notice that sin²(x) + cos²(x) = 1", or "Negative exponents represent reciprocals").`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overview: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.INTEGER },
                  subExpression: { type: Type.STRING },
                  rule: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
                required: ['step', 'subExpression', 'rule', 'value'],
              },
            },
            alternateRepresentations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mathematicalInsight: { type: Type.STRING },
          },
          required: ['title', 'overview', 'steps'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.warn('AI explain error, attempting local fallback:', error?.message);
    return res.json({
      title: `Evaluation of ${expression}`,
      overview: `The expression ${expression} evaluates to ${result} under standard mathematical order of operations.`,
      steps: [
        {
          step: 1,
          subExpression: expression,
          rule: 'Evaluate according to PEMDAS precedence',
          value: result,
        },
      ],
      alternateRepresentations: [result],
      mathematicalInsight: 'Remember that multiplication and division take precedence over addition and subtraction.',
    });
  }
});

// AI OCR & Handwritten / Photo Math Solver
app.post('/api/ai/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const promptText = `Analyze the mathematical equation, arithmetic expression, or math problem shown in this image.
1. Transcribe the math into standard scientific calculator syntax (e.g. "3 * (4 + 5) ^ 2 / sqrt(16)").
2. Provide standard LaTeX representation.
3. Solve the problem completely with numerical value and step-by-step breakdown.
4. If there is a variable x function to graph, output graphableFunction.`;

    const response = await generateWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcribedText: { type: Type.STRING, description: 'Readable transcription of the math problem' },
            latex: { type: Type.STRING, description: 'LaTeX representation of the formula' },
            calculatorExpression: { type: Type.STRING, description: 'Expression suitable to paste into the calculator' },
            result: { type: Type.STRING, description: 'Calculated solution' },
            explanationSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Steps showing how the equation was solved',
            },
            graphableFunction: { type: Type.STRING, nullable: true },
          },
          required: ['transcribedText', 'calculatorExpression', 'result', 'explanationSteps'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('AI OCR error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to recognize and solve image.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Scientific Calculator running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
