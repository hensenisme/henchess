interface EvalBarProps {
  eval: number | null      // centipawns, from White's perspective
  isThinking: boolean
}

const MAX_CP = 600  // beyond ±600cp, bar is essentially full

export function EvalBar({ eval: evalCp, isThinking }: EvalBarProps) {
  // Convert centipawns to a 0–100 percentage for White's advantage
  const whitePercent = evalCp === null
    ? 50
    : Math.round(50 + (Math.tanh(evalCp / MAX_CP) * 50))

  const blackPercent = 100 - whitePercent

  const formatEval = (cp: number | null): string => {
    if (cp === null) return '—'
    if (Math.abs(cp) >= 9999) return cp > 0 ? '+M' : '-M'
    const pawns = (cp / 100).toFixed(1)
    return cp >= 0 ? `+${pawns}` : pawns
  }

  return (
    <div className="eval-bar-container" aria-label={`Evaluation: ${formatEval(evalCp)}`}>
      {/* Eval label */}
      <div className="eval-label eval-label--black">
        {evalCp !== null && evalCp < 0 ? formatEval(evalCp) : ''}
      </div>

      {/* Bar */}
      <div className="eval-bar">
        {/* Black segment (top) */}
        <div
          className="eval-segment eval-segment--black"
          style={{ height: `${blackPercent}%` }}
        />
        {/* White segment (bottom) */}
        <div
          className="eval-segment eval-segment--white"
          style={{ height: `${whitePercent}%` }}
        />

        {/* Thinking pulse overlay */}
        {isThinking && <div className="eval-thinking-pulse" />}
      </div>

      {/* Eval label */}
      <div className="eval-label eval-label--white">
        {evalCp !== null && evalCp >= 0 ? formatEval(evalCp) : ''}
      </div>
    </div>
  )
}
