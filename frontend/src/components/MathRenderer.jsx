import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Helper to safely render KaTeX string
 */
function renderKaTeX(latex, isBlock = false) {
  try {
    return katex.renderToString(latex, {
      displayMode: isBlock,
      throwOnError: false,
    });
  } catch (e) {
    return `<span class="katex-error">${latex}</span>`;
  }
}

/**
 * Component that parses a string containing mixed plain text and LaTeX math ($...$ or $$...$$)
 * and renders KaTeX spans/blocks.
 */
export default function MathRenderer({ text, isBlockFormula = false, className = '' }) {
  if (!text) return null;

  // If this is an explicit standalone formula block (e.g. q.formula)
  if (isBlockFormula) {
    const cleanFormula = String(text).trim().replace(/^\$\$?|\$\$?$/g, '').trim();
    if (!cleanFormula) return null;
    const html = renderKaTeX(cleanFormula, true);
    return (
      <div
        className={`mock-katex-block ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  const rawText = String(text);

  // Split by $$block math$$ or $inline math$
  // Pattern matches:
  // 1. $$...$$ (Display math)
  // 2. $...$ (Inline math)
  const regex = /\$\$([\s\S]+?)\$\$|\$([^\$]+?)\$/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;

    // Plain text before the math match
    if (matchStart > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>{rawText.substring(lastIndex, matchStart)}</span>
      );
    }

    if (match[1] !== undefined) {
      // $$block math$$
      const blockMath = match[1].trim();
      const html = renderKaTeX(blockMath, true);
      elements.push(
        <div
          key={`block-${matchStart}`}
          className="mock-katex-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (match[2] !== undefined) {
      // $inline math$
      const inlineMath = match[2].trim();
      const html = renderKaTeX(inlineMath, false);
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

  // Trailing plain text
  if (lastIndex < rawText.length) {
    elements.push(
      <span key={`text-${lastIndex}`}>{rawText.substring(lastIndex)}</span>
    );
  }

  return <span className={`math-rendered-wrap ${className}`}>{elements}</span>;
}
