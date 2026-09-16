import React, { useState } from "react";

const API_ENDPOINT = "/api/quiz/generate/";

export default function QuizPage() {
  const [phase, setPhase] = useState("setup"); // "setup" | "quiz" | "results"
  const [topicDescription, setTopicDescription] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [quiz, setQuiz] = useState(null); // { title, num_questions, questions: [...] }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: selectedOptionId }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topicDescription.trim()) {
      setError("Please describe the topic you want quizzed on.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_description: topicDescription,
          num_questions: Number(numQuestions) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate quiz.");
      }
      setQuiz(data.quiz);
      setAnswers({});
      setCurrentIndex(0);
      setPhase("quiz");
    } catch (err) {
      setError(err.message || "Something went wrong generating the quiz.");
    } finally {
      setLoading(false);
    }
  }

  function selectOption(questionId, optionId) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function goNext() {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }

  function handleSubmit() {
    setPhase("results");
  }

  function handleRestart() {
    setPhase("setup");
    setQuiz(null);
    setAnswers({});
    setCurrentIndex(0);
    setError(null);
  }

  function computeScore() {
    if (!quiz) return { correct: 0, total: 0 };
    let correct = 0;
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correct_option_id) correct += 1;
    });
    return { correct, total: quiz.questions.length };
  }

  return (
    <div className="quiz-page">
      {phase === "setup" && (
        <QuizSetup
          topicDescription={topicDescription}
          setTopicDescription={setTopicDescription}
          numQuestions={numQuestions}
          setNumQuestions={setNumQuestions}
          onSubmit={handleGenerate}
          loading={loading}
          error={error}
        />
      )}

      {phase === "quiz" && quiz && (
        <QuizRunner
          quiz={quiz}
          currentIndex={currentIndex}
          answers={answers}
          onSelect={selectOption}
          onNext={goNext}
          onPrev={goPrev}
          onSubmit={handleSubmit}
        />
      )}

      {phase === "results" && quiz && (
        <QuizResults
          quiz={quiz}
          answers={answers}
          score={computeScore()}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Setup screen
// ---------------------------------------------------------------------
function QuizSetup({
  topicDescription,
  setTopicDescription,
  numQuestions,
  setNumQuestions,
  onSubmit,
  loading,
  error,
}) {
  return (
    <div className="quiz-setup-card glass-card">
      <h1 className="quiz-title">✨ Generate a Quiz</h1>
      <p className="quiz-subtitle">
        Describe the topic (as specific or broad as you like). You can also
        mention the number of questions directly in the description — e.g.
        "15 questions on TCP/IP layering" — or set it below.
      </p>

      <form onSubmit={onSubmit} className="quiz-setup-form">
        <label className="quiz-label" htmlFor="topic-description">
          Topic description
        </label>
        <textarea
          id="topic-description"
          className="quiz-textarea"
          rows={5}
          placeholder="e.g. Operating Systems — process scheduling algorithms, deadlocks, and memory management, focused on 4th semester KIIT syllabus"
          value={topicDescription}
          onChange={(e) => setTopicDescription(e.target.value)}
        />

        <label className="quiz-label" htmlFor="num-questions">
          Number of questions
        </label>
        <input
          id="num-questions"
          type="number"
          min={1}
          max={30}
          className="quiz-number-input"
          value={numQuestions}
          onChange={(e) => setNumQuestions(e.target.value)}
        />

        {error && <div className="quiz-error">{error}</div>}

        <button type="submit" className="quiz-btn quiz-btn-primary" disabled={loading}>
          {loading ? "Generating quiz…" : "Generate Quiz"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------
// Quiz runner — one question card at a time
// ---------------------------------------------------------------------
function QuizRunner({ quiz, currentIndex, answers, onSelect, onNext, onPrev, onSubmit }) {
  const question = quiz.questions[currentIndex];
  const total = quiz.questions.length;
  const isLast = currentIndex === total - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="quiz-runner">
      <div className="quiz-progress-bar">
        <div
          className="quiz-progress-fill"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      <div className="quiz-meta-row">
        <span>{quiz.title}</span>
        <span>
          Question {currentIndex + 1} / {total}
        </span>
      </div>

      <div className="quiz-question-card glass-card">
        <h2 className="quiz-question-text">{question.question}</h2>

        <div className="quiz-options-grid">
          {question.options.map((opt) => {
            const selected = answers[question.id] === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`quiz-option-card${selected ? " quiz-option-selected" : ""}`}
                onClick={() => onSelect(question.id, opt.id)}
              >
                <span className="quiz-option-letter">{opt.id.toUpperCase()}</span>
                <span className="quiz-option-text">{opt.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="quiz-nav-row">
        <button
          type="button"
          className="quiz-btn quiz-btn-secondary"
          onClick={onPrev}
          disabled={currentIndex === 0}
        >
          ← Previous
        </button>

        <span className="quiz-answered-count">
          {answeredCount} / {total} answered
        </span>

        {isLast ? (
          <button type="button" className="quiz-btn quiz-btn-primary" onClick={onSubmit}>
            Submit Quiz
          </button>
        ) : (
          <button type="button" className="quiz-btn quiz-btn-primary" onClick={onNext}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Results screen — score + per-question explanation cards
// ---------------------------------------------------------------------
function QuizResults({ quiz, answers, score, onRestart }) {
  const percentage = Math.round((score.correct / score.total) * 100);

  return (
    <div className="quiz-results">
      <div className="quiz-score-card glass-card">
        <h1 className="quiz-title">{quiz.title}</h1>
        <div className="quiz-score-circle" style={{ '--pct': `${percentage}%` }}>
          <span className="quiz-score-number">{percentage}%</span>
        </div>
        <p className="quiz-score-text">
          {score.correct} / {score.total} correct
        </p>
        <button type="button" className="quiz-btn quiz-btn-primary" onClick={onRestart}>
          New Quiz
        </button>
      </div>

      <div className="quiz-review-list">
        {quiz.questions.map((q, idx) => {
          const userAnswer = answers[q.id];
          const isCorrect = userAnswer === q.correct_option_id;

          return (
            <div
              key={q.id}
              className={`quiz-review-card glass-card${
                isCorrect ? " quiz-review-correct" : " quiz-review-incorrect"
              }`}
            >
              <div className="quiz-review-header">
                <span className="quiz-review-index">Q{idx + 1}</span>
                <span className={`quiz-review-badge ${isCorrect ? "badge-correct" : "badge-incorrect"}`}>
                  {isCorrect ? "Correct" : userAnswer ? "Incorrect" : "Skipped"}
                </span>
              </div>

              <p className="quiz-review-question">{q.question}</p>

              <div className="quiz-review-options">
                {q.options.map((opt) => {
                  const isUserChoice = opt.id === userAnswer;
                  const isCorrectChoice = opt.id === q.correct_option_id;
                  let cls = "quiz-review-option";
                  if (isCorrectChoice) cls += " option-correct";
                  else if (isUserChoice && !isCorrectChoice) cls += " option-wrong";

                  return (
                    <div key={opt.id} className={cls}>
                      <span className="quiz-option-letter">{opt.id.toUpperCase()}</span>
                      <span>{opt.text}</span>
                      {isUserChoice && <span className="quiz-your-pick">Your pick</span>}
                    </div>
                  );
                })}
              </div>

              <div className="quiz-explanation">
                <strong>Explanation:</strong> {q.explanation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
