import type { MoveAnalysis } from '../hooks/useChessGame'
import { EvalGraph } from './EvalGraph'

interface AnalysisPanelProps {
  analysis: MoveAnalysis[] | null
  isAnalyzing: boolean
  onRequestAnalysis: () => void
  gameStatus: string
  reviewIndex: number | null
  setReviewIndex: (index: number | null) => void
}

export function AnalysisPanel({ 
  analysis, 
  isAnalyzing, 
  onRequestAnalysis, 
  gameStatus,
  reviewIndex,
  setReviewIndex
}: AnalysisPanelProps) {
  if (gameStatus === 'playing') return null

  return (
    <div className="analysis-panel card fade-in">
      <h3>Post-Game Analysis</h3>
      
      {!analysis && !isAnalyzing && (
        <div className="analysis-prompt">
          <p>The game has ended. Would you like to analyze the moves?</p>
          <button className="btn primary" onClick={onRequestAnalysis}>
            Analyze Game
          </button>
        </div>
      )}

      {isAnalyzing && (
        <div className="analysis-loading">
          <div className="spinner"></div>
          <p>Analyzing game with Stockfish...</p>
        </div>
      )}

      {analysis && (
        <div className="analysis-results">
          <div className="analysis-summary">
            <div className="summary-stat">
              <span className="stat-value">{analysis.filter(m => m.classification.label === 'Brilliant').length}</span>
              <span className="stat-label">Brilliant</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">{analysis.filter(m => m.classification.label === 'Great').length}</span>
              <span className="stat-label">Great</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">{analysis.filter(m => m.classification.label === 'Mistake').length}</span>
              <span className="stat-label">Mistakes</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">{analysis.filter(m => m.classification.label === 'Blunder').length}</span>
              <span className="stat-label">Blunders</span>
            </div>
          </div>

          <EvalGraph analysis={analysis} />

          {reviewIndex !== null && (
            <div className="review-controls" style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
              <button 
                className="btn secondary" 
                disabled={reviewIndex <= 0}
                onClick={() => setReviewIndex(reviewIndex - 1)}
              >
                ◀ Prev
              </button>
              <button 
                className="btn primary" 
                onClick={() => setReviewIndex(null)}
              >
                Exit Review
              </button>
              <button 
                className="btn secondary" 
                disabled={reviewIndex >= analysis.length - 1}
                onClick={() => setReviewIndex(reviewIndex + 1)}
              >
                Next ▶
              </button>
            </div>
          )}

          <div className="moves-list">
            {analysis.map((move, idx) => {
              const moveNum = Math.floor(idx / 2) + 1
              const isWhite = idx % 2 === 0
              
              return (
                <div 
                  key={idx} 
                  className={`move-analysis-row ${move.classification.label.toLowerCase()} ${reviewIndex === idx ? 'active-review' : ''}`}
                  onClick={() => setReviewIndex(idx)}
                  style={{ cursor: 'pointer', border: reviewIndex === idx ? '2px solid #fff' : 'none' }}
                >
                  <div className="move-number">{isWhite ? `${moveNum}.` : ''}</div>
                  <div className="move-san">{move.san}</div>
                  <div className="move-eval">
                    {move.eval_after > 0 ? '+' : ''}{(move.eval_after / 100).toFixed(1)}
                  </div>
                  <div className="move-badge" style={{ backgroundColor: move.classification.color }}>
                    <span className="icon">{move.classification.icon}</span>
                    <span className="label">{move.classification.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
