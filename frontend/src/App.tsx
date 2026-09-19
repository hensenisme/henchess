import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useChessGame } from './hooks/useChessGame'
import { GameControls } from './components/GameControls'
import { EvalBar } from './components/EvalBar'
import { PromotionModal } from './components/PromotionModal'
import { AnalysisPanel } from './components/AnalysisPanel'
import './App.css'

function App() {
  const {
    game,
    mode,
    targetElo,
    isThinking,
    lastEval,
    lastPolicy,
    gameStatus,
    gameOverReason,
    error,
    pendingPromotion,
    analysis,
    isAnalyzing,
    onDrop,
    resetGame,
    resign,
    setMode,
    setTargetElo,
    confirmPromotion,
    requestAnalysis,
  } = useChessGame()

  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({})
  const [moveFrom, setMoveFrom] = useState<string | null>(null)

  const boardDisabled = isThinking || gameStatus !== 'playing'

  function getMoveOptions(square: string) {
    const moves = game.moves({
      square: square as any,
      verbose: true
    })
    if (moves.length === 0) {
      setOptionSquares({})
      return
    }

    const newSquares: Record<string, React.CSSProperties> = {}
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as any) && game.get(move.to as any)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      }
    })
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    }
    setOptionSquares(newSquares)
  }

  function handlePieceDrop(sourceSquare: string, targetSquare: string) {
    setOptionSquares({})
    setMoveFrom(null)
    if (boardDisabled) return false
    return onDrop(sourceSquare as any, targetSquare as any)
  }

  function handleSquareClick(square: string) {
    if (moveFrom) {
      // If we click the same square, deselect
      if (moveFrom === square) {
        setMoveFrom(null)
        setOptionSquares({})
        return
      }
      
      // Attempt move
      const moveSuccess = handlePieceDrop(moveFrom, square)
      if (moveSuccess) return
    }

    // Select piece
    const piece = game.get(square as any)
    if (piece) {
      setMoveFrom(square)
      getMoveOptions(square)
    } else {
      setMoveFrom(null)
      setOptionSquares({})
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">♟</span>
          <span className="logo-text">HenChess</span>
        </div>
        <p className="header-subtitle">Hybrid AI Sparring</p>
      </header>

      {/* Main layout */}
      <main className="app-main">
        {/* Eval Bar */}
        <EvalBar eval={lastEval} isThinking={isThinking} />

        {/* Board */}
        <div className="board-wrapper">
          {/* Game Over Overlay */}
          {gameStatus !== 'playing' && (
            <div className="game-over-overlay">
              <div className="game-over-card">
                <div className="game-over-icon">
                  {gameStatus === 'checkmate' ? '♚' :
                   gameStatus === 'resigned' ? '🏳' : '½'}
                </div>
                <h2 className="game-over-title">
                  {gameStatus === 'checkmate' ? 'Checkmate' :
                   gameStatus === 'resigned' ? 'Resigned' :
                   gameStatus === 'stalemate' ? 'Stalemate' : 'Draw'}
                </h2>
                <p className="game-over-reason">{gameOverReason}</p>
                <button
                  id="btn-play-again"
                  className="action-btn action-btn--primary"
                  onClick={resetGame}
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

          <Chessboard
            options={{
              position: game.fen(),
              onPieceDrop: ({ sourceSquare, targetSquare }) => handlePieceDrop(sourceSquare, targetSquare ?? ''),
              onPieceDrag: ({ square }) => getMoveOptions(square ?? ''),
              onSquareClick: ({ square }) => handleSquareClick(square ?? ''),
              boardOrientation: 'white',
              animationDurationInMs: 200,
              boardStyle: {
                borderRadius: '8px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              },
              squareStyles: optionSquares,
              darkSquareStyle: { backgroundColor: '#5b8bdf' },
              lightSquareStyle: { backgroundColor: '#eef0f8' }
            }}
          />
        </div>

        <PromotionModal
          isOpen={!!pendingPromotion}
          color={pendingPromotion?.color || 'w'}
          onSelect={confirmPromotion}
          onCancel={() => confirmPromotion(null)}
        />

        {/* Sidebar */}
        <div className="sidebar">
          <GameControls
            mode={mode}
            targetElo={targetElo}
            isThinking={isThinking}
            lastPolicy={lastPolicy}
            gameStatus={gameStatus}
            onModeChange={setMode}
            onEloChange={setTargetElo}
            onNewGame={resetGame}
            onResign={resign}
          />

          <AnalysisPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onRequestAnalysis={requestAnalysis}
            gameStatus={gameStatus}
          />
        </div>
      </main>

      {/* Error toast */}
      {error && (
        <div className="error-toast" role="alert">
          <span>⚠ {error}</span>
        </div>
      )}
    </div>
  )
}

export default App
