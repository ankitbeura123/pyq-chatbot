import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

export const STATUS_WORDS = [
  'Epistemizing',
  'Hypothesizing',
  'Conceptualizing',
  'Deconstructing',
  'Extrapolating',
  'Correlating',
  'Inferring',
  'Deducting',
  'Postulating',
  'Interpolating',
  'Reconciling',
  'Disambiguating',
  'Circumventing',
  'Paradigming',
  'Contextualizing',
  'Newtonizing',
  'Quantifying',
  'Quantumizing',
  'Theorizing',
  'Axiomizing',
  'Generalizing',
  'Formalizing',
  'Linearizing',
  'Differentiating',
  'Integrating',
  'Simulating',
  'Optimizing',
  'Parametrizing',
  'Calculating',
  'Approximating',
  'Iterating',
  'Converging',
  'Diverging',
  'Tensorizing',
  'Eigencomputing',
  'Vectorizing',
  'Matrixizing',
  'Probabilizing',
  'Stochastifying',
  'Neuralizing',
  'Cognifying',
  'Synthesizing',
  'Metamorphosing',
  'Reconstructing',
  'Crystallizing',
  'Recontextualizing',
  'Transmuting',
  'Recalibrating',
  'Neuromorphing',
  'Hypercomputing',
  'Cognitizing',
  'Algorithmizing',
  'Sentientizing',
  'Bayesianizing',
  'Ontologizing',
  'Tokenizing',
  'Embedding',
  'Normalizing',
  'Quantizing',
  'Backpropagating',
  'Decomposing',
  'Propagating',
  'Parameterizing',
  'Discretizing',
  'Indexing',
  'Refactoring',
  'Interpreting',
  'Evaluating',
  'Investigating',
  'Orchestrating',
  'Deciphering',
  'Architecting',
  'Illuminating',
  'Unraveling',
  'Calibrating',
];

export default function ThinkingIndicator() {
  // Immediately select one random word on initial mount
  const [currentWord, setCurrentWord] = useState(() => {
    return STATUS_WORDS[Math.floor(Math.random() * STATUS_WORDS.length)];
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    let timeoutId = null;
    let transitionTimeoutId = null;
    let isMounted = true;

    const scheduleNextWord = () => {
      // Randomized interval between 6000ms and 9000ms (averaging approx 7.5s)
      const delay = Math.floor(6000 + Math.random() * 3000);
      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        // Smooth fade-out before word switch
        setIsTransitioning(true);

        transitionTimeoutId = setTimeout(() => {
          if (!isMounted) return;

          // Select next word ensuring no consecutive repetition
          setCurrentWord((prev) => {
            const pool = STATUS_WORDS.filter((w) => w !== prev);
            return pool[Math.floor(Math.random() * pool.length)];
          });

          // Trigger smooth fade-in
          setIsTransitioning(false);

          // Schedule next rotation
          scheduleNextWord();
        }, 220);
      }, delay);
    };

    scheduleNextWord();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (transitionTimeoutId) clearTimeout(transitionTimeoutId);
    };
  }, []);

  return (
    <div className="chat-bubble thinking-bubble" role="status" aria-live="polite">
      <div className="thinking-container">
        <span className="thinking-sparkle" aria-hidden="true">
          <Sparkles size={14} />
        </span>
        <span className="thinking-status-text">
          <span className={`thinking-word ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
            {currentWord}
          </span>
          <span className="thinking-dots" aria-hidden="true">
            <span className="thinking-dot">.</span>
            <span className="thinking-dot">.</span>
            <span className="thinking-dot">.</span>
          </span>
        </span>
      </div>
    </div>
  );
}
