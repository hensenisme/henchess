import type { EngineMode } from '../hooks/useChessGame'

interface GameControlsProps {
  mode: EngineMode
  targetElo: number
  isThinking: boolean
  lastPolicy: number | null
  gameStatus: string
  onModeChange: (mode: EngineMode) => void
  onEloChange: (elo: number) => void
  onNewGame: () => void
  onResign: () => void
}

const MODES: { value: EngineMode; label: string; description: string; soon?: boolean }[] = [
  { value: 'stockfish', label: 'Stockfish', description: 'Pure engine strength' },
  { value: 'hybrid', label: 'Hybrid', description: 'Stockfish + Maia blend' },
  { value: 'maia', label: 'Maia', description: 'Plays like a human' },
]

const ELO_MARKS = [800, 1000, 1200, 1500, 1800, 2000, 2200, 2500, 2800]

export function GameControls({
  mode,
  targetElo,
  isThinking,
  lastPolicy,
  gameStatus,
  onModeChange,
  onEloChange,
  onNewGame,
  onResign,
}: GameControlsProps) {
  const isPlaying = gameStatus === 'playing'

  return (
    <div className="controls-panel">
      {/* Engine Mode */}
      <section className="control-section">
        <h3 className="control-label">Engine Mode</h3>
        <div className="mode-buttons" role="group" aria-label="Engine mode selection">
          {MODES.map(m => (
            <button
              key={m.value}
              id={`mode-btn-${m.value}`}
              className={`mode-btn ${mode === m.value ? 'mode-btn--active' : ''} ${m.soon ? 'mode-btn--soon' : ''}`}
              onClick={() => onModeChange(m.value)}
              title={m.description}
              aria-pressed={mode === m.value}
            >
              {m.label}
              {m.soon && <span className="soon-badge">Soon</span>}
            </button>
          ))}
        </div>
        <p className="mode-description">
          {MODES.find(m => m.value === mode)?.description}
        </p>
      </section>

      {/* ELO Slider — only shown for Maia / Hybrid */}
      {mode !== 'stockfish' && (
        <section className="control-section">
          <h3 className="control-label">
            Target ELO
            <span className="elo-badge">{targetElo}</span>
          </h3>
          <input
            id="elo-slider"
            type="range"
            min={800}
            max={2800}
            step={100}
            value={targetElo}
            onChange={e => onEloChange(Number(e.target.value))}
            className="elo-slider"
            aria-label={`Target ELO: ${targetElo}`}
          />
          <div className="elo-marks">
            {ELO_MARKS.map(mark => (
              <span
                key={mark}
                className={`elo-mark ${targetElo === mark ? 'elo-mark--active' : ''}`}
              >
                {mark}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* AI Status */}
      <section className="control-section">
        <div className="status-row">
          <div className={`thinking-indicator ${isThinking ? 'thinking-indicator--active' : ''}`}>
            <span className="thinking-dot" />
            <span>{isThinking ? 'Thinking…' : 'Ready'}</span>
          </div>
          {lastPolicy !== null && (
            <div className="policy-badge" title="Maia policy probability for this move">
              Policy {(lastPolicy * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </section>

      {/* Action Buttons */}
      <section className="control-section control-section--actions">
        <button
          id="btn-new-game"
          className="action-btn action-btn--primary"
          onClick={onNewGame}
        >
          New Game
        </button>
        {isPlaying && (
          <button
            id="btn-resign"
            className="action-btn action-btn--danger"
            onClick={onResign}
            disabled={isThinking}
          >
            Resign
          </button>
        )}
      </section>
    </div>
  )
}
