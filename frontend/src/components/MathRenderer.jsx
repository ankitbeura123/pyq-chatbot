import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Sanitize incoming text by repairing corrupted control characters
 * and common JSON LaTeX decoding glitches.
 */
function sanitizeMathInput(raw) {
  if (!raw) return '';
  let s = String(raw);

  // Repair control character collisions from unescaped JSON
  s = s.replace(/\x0c([a-zA-Z]+)/g, '\\f$1');  // \x0crac -> \frac
  s = s.replace(/\x08([a-zA-Z]+)/g, '\\b$1');  // \x08eta -> \beta, \x08egin -> \begin
  s = s.replace(/\t(heta|au|imes|o|an|ext|ilde|riangle|op)/g, '\\t$1');
  s = s.replace(/\n(eq|abla|u|ot|atural)/g, '\\n$1');
  s = s.replace(/\r(ho|ight|angle|rightarrow)/g, '\\r$1');
  s = s.replace(/\x0c/g, '\\f');
  s = s.replace(/\x08/g, '\\b');
  s = s.replace(/\x0b/g, '\\v');

  // Repair bare 'rac{' if prefix backslash was dropped
  s = s.replace(/(?<!\\)\brac\{/g, '\\frac{');

  return s;
}

/**
 * Greek letter and symbol mapping for graceful fallback typography
 */
const GREEK_UNICODE_MAP = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
  '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π',
  '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ',
  '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ', '\\Phi': 'Φ', '\\Psi': 'Ψ',
  '\\Omega': 'Ω'
};

const SYMBOL_UNICODE_MAP = {
  '\\times': ' × ', '\\cdot': ' · ', '\\div': ' ÷ ', '\\pm': ' ± ', '\\mp': ' ∓ ',
  '\\le': ' ≤ ', '\\leq': ' ≤ ', '\\ge': ' ≥ ', '\\geq': ' ≥ ',
  '\\neq': ' ≠ ', '\\ne': ' ≠ ', '\\approx': ' ≈ ', '\\equiv': ' ≡ ',
  '\\infty': ' ∞ ', '\\partial': '∂', '\\nabla': '∇',
  '\\int': '∫', '\\sum': '∑', '\\prod': '∏',
  '\\rightarrow': ' → ', '\\to': ' → ', '\\leftarrow': ' ← ',
  '\\leftrightarrow': ' ↔ ', '\\Rightarrow': ' ⇒ ', '\\Leftarrow': ' ⇐ ',
  '\\in': ' ∈ ', '\\notin': ' ∉ ', '\\subset': ' ⊂ ', '\\subseteq': ' ⊆ ',
  '\\cup': ' ∪ ', '\\cap': ' ∩ ', '\\forall': '∀', '\\exists': '∃',
  '\\perp': ' ⊥ ', '\\angle': '∠', '\\circ': '°',
  '\\mathcal{O}': 'O', '\\text{O}': 'O', '\\mathbf{O}': 'O'
};

function formatFallbackMath(latex) {
  let s = String(latex).trim();
  for (const [cmd, sym] of Object.entries(GREEK_UNICODE_MAP)) {
    s = s.split(cmd).join(sym);
  }
  for (const [cmd, sym] of Object.entries(SYMBOL_UNICODE_MAP)) {
    s = s.split(cmd).join(sym);
  }
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  s = s.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  s = s.replace(/\^([a-zA-Z0-9+\-]+)/g, '<sup>$1</sup>');
  s = s.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  s = s.replace(/_([a-zA-Z0-9+\-]+)/g, '<sub>$1</sub>');
  s = s.replace(/\\(?:text|mathrm|mathbf)\{([^}]+)\}/g, '$1');
  s = s.replace(/\\[a-zA-Z]+/g, '');
  return s;
}

/**
 * Safely render KaTeX string with error protection
 */
function renderKaTeXSafe(latex, isBlock = false) {
  if (!latex || !latex.trim()) return '';
  const cleanLatex = String(latex)
    .trim()
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\$\$?|\$\$?$/g, '')
    .trim();

  if (!cleanLatex) return '';

  try {
    const html = katex.renderToString(cleanLatex, {
      displayMode: isBlock,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });

    // If KaTeX marked an internal syntax error, fallback gracefully
    if (html.includes('katex-error')) {
      const fallback = formatFallbackMath(cleanLatex);
      return `<span class="math-fallback">${fallback}</span>`;
    }
    return html;
  } catch (e) {
    const fallback = formatFallbackMath(cleanLatex);
    return `<span class="math-fallback">${fallback}</span>`;
  }
}

/**
 * Normalize and extract markdown tables from text
 */
function normalizeAndExtractTables(rawText) {
  if (!rawText) return [];
  let text = String(rawText)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Insert newline before separator row if jammed into header line: e.g. "Col 1 | Col 2 ---|--- Row 1"
  text = text.replace(/(\|?[^\n|]+(?:\|[^\n|]+)+\|?)\s+((?:[\s:]*-+[\s:]*\|)+[\s:\-\|]+)/g, '$1\n$2');
  // Insert newline after separator row if jammed into data row:
  text = text.replace(/((?:[\s:]*-+[\s:]*\|)+[\s:\-\|]+)\s+(\|?[^\n|]+\|[^\n]+)/g, '$1\n$2');

  const tablePattern = /(?:^|\n)([ \t]*\|?[^\n|]+\|[^\n]+\|?[ \t]*\n)([ \t]*\|?[\s:]*-+[\s:]*\|[\s:\-\|]+[ \t]*\n)((?:[ \t]*\|?[^\n|]+\|[^\n]+\|?[ \t]*(?:\n|$))+)/g;

  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = tablePattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = tablePattern.lastIndex;

    const preText = text.substring(lastIndex, matchStart).trim();
    if (preText) {
      segments.push({ type: 'text', content: preText });
    }

    const headerLine = match[1].trim();
    const dataBlock = match[3].trim();

    const headers = headerLine
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(c => c.trim())
      .filter(c => c !== '');

    const rows = [];
    const lines = dataBlock.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cells = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(c => c.trim());
      if (cells.length > 0 && cells.some(c => c !== '')) {
        rows.push(cells);
      }
    }

    if (headers.length > 0 && rows.length > 0) {
      segments.push({ type: 'table', headers, rows });
    } else {
      segments.push({ type: 'text', content: match[0].trim() });
    }

    lastIndex = matchEnd;
  }

  const postText = text.substring(lastIndex).trim();
  if (postText) {
    segments.push({ type: 'text', content: postText });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

/**
 * Component that parses text containing LaTeX math and markdown tables:
 * - Markdown tables: | Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |
 * - Block math: $$...$$ or \[...\]
 * - Inline math: $...$ or \(...\)
 * - Standalone formula block: isBlockFormula={true}
 * - Bare LaTeX commands in text (e.g. \frac, \sqrt, \alpha)
 */
export default function MathRenderer({ text, isBlockFormula = false, className = '' }) {
  if (!text) return null;

  const sanitized = sanitizeMathInput(text);

  // If this is an explicit standalone formula block (e.g. q.formula)
  if (isBlockFormula) {
    const html = renderKaTeXSafe(sanitized, true);
    if (!html) return null;
    return (
      <div
        className={`mock-katex-block ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Check for markdown tables
  const segments = normalizeAndExtractTables(sanitized);

  // If there are tables embedded in the text
  if (segments.some(s => s.type === 'table')) {
    return (
      <span className={`math-rendered-wrap ${className}`}>
        {segments.map((seg, segIdx) => {
          if (seg.type === 'table') {
            return (
              <div className="mock-table-wrapper" key={`tbl-${segIdx}`}>
                <table className="mock-exam-table">
                  <thead>
                    <tr>
                      {seg.headers.map((h, hIdx) => (
                        <th key={hIdx}>
                          <MathContentRenderer content={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seg.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>
                            <MathContentRenderer content={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          return <MathContentRenderer key={`txt-${segIdx}`} content={seg.content} />;
        })}
      </span>
    );
  }

  return <MathContentRenderer content={sanitized} className={className} />;
}

/**
 * Parses LaTeX math expressions ($...$, $$...$$, \(...\), \[...\]) within a text block
 */
function MathContentRenderer({ content, className = '' }) {
  if (!content) return null;

  const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^\$]+?)\$|\\\(([\s\S]+?)\\\)/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;

    if (matchStart > lastIndex) {
      const plainChunk = content.substring(lastIndex, matchStart);
      elements.push(
        <span key={`text-${lastIndex}`}>{renderPlainWithBareMath(plainChunk, lastIndex)}</span>
      );
    }

    const blockMath = match[1] || match[2];
    const inlineMath = match[3] || match[4];

    if (blockMath !== undefined) {
      const html = renderKaTeXSafe(blockMath, true);
      elements.push(
        <div
          key={`block-${matchStart}`}
          className="mock-katex-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (inlineMath !== undefined) {
      const html = renderKaTeXSafe(inlineMath, false);
      elements.push(
        <span
          key={`inline-${matchStart}`}
          className="mock-katex-inline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < content.length) {
    const trailingChunk = content.substring(lastIndex);
    elements.push(
      <span key={`text-${lastIndex}`}>{renderPlainWithBareMath(trailingChunk, lastIndex)}</span>
    );
  }

  return <span className={`math-text-chunk ${className}`}>{elements}</span>;
}

/**
 * Helper to auto-detect and format bare LaTeX commands inside plain text chunks
 */
function renderPlainWithBareMath(chunk, baseIndex) {
  if (!chunk) return null;

  const hasBareLatex = /\\(?:frac|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|Delta|Omega|sum|int|lim|times|pm|approx|leq|geq|neq)\b/.test(chunk);

  if (!hasBareLatex) {
    return chunk;
  }

  if (chunk.trim().startsWith('\\frac') || chunk.trim().startsWith('\\int') || chunk.trim().startsWith('\\sum')) {
    const html = renderKaTeXSafe(chunk, false);
    return <span className="mock-katex-inline" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return chunk;
}


