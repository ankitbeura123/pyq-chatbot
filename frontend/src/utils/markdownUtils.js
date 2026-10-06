import katex from 'katex';
import 'katex/dist/katex.min.css';
import { marked } from 'marked';

// Configure marked with GFM (GitHub Flavored Markdown) and line breaks
marked.setOptions({
  breaks: true,
  gfm: true
});

/**
 * Sanitize incoming text by repairing corrupted control characters
 * and common JSON LaTeX decoding collisions.
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
 * Greek letter and symbol mapping for fallback typography if KaTeX fails
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
  '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉'
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
      strict: false
    });

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
 * Full Markdown + KaTeX Renderer for Chat Messages
 */
export function renderChatMarkdown(rawText) {
  if (!rawText) return '';
  let text = sanitizeMathInput(rawText);

  // 1. Normalize <details> and <summary> tags to ensure valid markdown inside
  text = text.replace(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>/gi, (match, summaryText) => {
    const cleanSummary = summaryText.trim();
    return `\n\n<details>\n<summary>${cleanSummary}</summary>\n\n`;
  });
  text = text.replace(/<\/details>/gi, '\n\n</details>\n\n');

  // 2. Extract Block Math ($$...$$ and \[...\])
  const mathPlaceholders = {};
  let mathCounter = 0;

  text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (match, p1, p2) => {
    const math = (p1 || p2 || '').trim();
    if (!math) return match;
    const token = `@@MATH_BLOCK_${mathCounter++}@@`;
    const html = renderKaTeXSafe(math, true);
    mathPlaceholders[token] = `<div class="katex-display-wrapper">${html}</div>`;
    return token;
  });

  // 3. Extract Inline Math ($...$ and \(...\))
  text = text.replace(/\$([^\$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, (match, p1, p2) => {
    const math = (p1 || p2 || '').trim();
    if (!math) return match;
    const token = `@@MATH_INLINE_${mathCounter++}@@`;
    const html = renderKaTeXSafe(math, false);
    mathPlaceholders[token] = `<span class="katex-inline-wrapper">${html}</span>`;
    return token;
  });

  // 4. Parse Markdown into HTML
  let html = marked.parse(text, { breaks: true, gfm: true });

  // 5. Restore Math HTML Placeholders
  for (const [token, mathHtml] of Object.entries(mathPlaceholders)) {
    html = html.split(token).join(mathHtml);
  }

  return html;
}
