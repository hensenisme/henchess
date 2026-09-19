import { useState, useCallback } from 'react'
import { Chess } from 'chess.js'
import type { PieceSymbol, Square } from 'chess.js'

const API_BASE = 'http://localhost:8000'

export type EngineMode = 'stockfish' | 'maia' | 'hybrid'

export type GameStatus =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resigned'

interface MoveResponse {
  move: string | null
  eval: number | null
  policy: number | null
  mode: string
  game_over: boolean
  game_over_reason: string | null
}

export interface MoveAnalysis {
  move: string
  san: string
  fen_before: string
  fen_after: string
  eval_before: number
  eval_after: number
  delta: number
  classification: {
    label: string
    color: string
    icon: string
  }
}

interface GameState {
  game: Chess
  mode: EngineMode
  targetElo: number
  isThinking: boolean
  lastEval: number | null
  lastPolicy: number | null
  gameStatus: GameStatus
  gameOverReason: string | null
  error: string | null
  pendingPromotion: { sourceSquare: Square; targetSquare: Square; color: 'w' | 'b' } | null
  analysis: MoveAnalysis[] | null
  isAnalyzing: boolean
}

export function useChessGame() {
  const [state, setState] = useState<GameState>({
    game: new Chess(),
    mode: 'stockfish',
    targetElo: 1500,
    isThinking: false,
    lastEval: null,
    lastPolicy: null,
    gameStatus: 'playing',
    gameOverReason: null,
    error: null,
    pendingPromotion: null,
    analysis: null,
    isAnalyzing: false,
  })

  // ── Helpers ──────────────────────────────────────────────────────────────

  const checkLocalGameOver = (game: Chess): { over: boolean; reason: string } => {
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'Black' : 'White'
      return { over: true, reason: `Checkmate — ${winner} wins` }
    }
    if (game.isStalemate()) return { over: true, reason: 'Stalemate' }
    if (game.isInsufficientMaterial()) return { over: true, reason: 'Draw — Insufficient material' }
    if (game.isThreefoldRepetition()) return { over: true, reason: 'Draw — Threefold repetition' }
    if (game.isDraw()) return { over: true, reason: 'Draw' }
    return { over: false, reason: '' }
  }

  const resolveGameStatus = (reason: string): GameStatus => {
    if (reason.toLowerCase().includes('checkmate')) return 'checkmate'
    if (reason.toLowerCase().includes('stalemate')) return 'stalemate'
    if (reason.toLowerCase().includes('draw')) return 'draw'
    return 'stalemate'
  }

  // ── AI Move Request ───────────────────────────────────────────────────────

  const requestAIMove = useCallback(async (currentGame: Chess, mode: EngineMode, targetElo: number) => {
    setState(prev => ({ ...prev, isThinking: true, error: null }))

    try {
      const response = await fetch(`${API_BASE}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: currentGame.fen(),
          mode,
          target_elo: targetElo,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail ?? `Server error ${response.status}`)
      }

      const data: MoveResponse = await response.json()

      if (data.game_over || !data.move) {
        const reason = data.game_over_reason ?? 'Game over'
        setState(prev => ({
          ...prev,
          isThinking: false,
          gameStatus: resolveGameStatus(reason),
          gameOverReason: reason,
        }))
        return
      }

      // Apply AI move
      const newGame = new Chess()
      newGame.loadPgn(currentGame.pgn())
      newGame.move(data.move)

      const localOver = checkLocalGameOver(newGame)

      setState(prev => {
        // If the game ended (e.g. player resigned) while AI was thinking, ignore the move
        if (prev.gameStatus !== 'playing') {
          return { ...prev, isThinking: false }
        }

        return {
          ...prev,
          game: newGame,
          isThinking: false,
          lastEval: data.eval ?? prev.lastEval,
          lastPolicy: data.policy ?? null,
          gameStatus: localOver.over ? resolveGameStatus(localOver.reason) : 'playing',
          gameOverReason: localOver.over ? localOver.reason : null,
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        isThinking: false,
        error: `Engine error: ${message}`,
      }))
    }
  }, [])

  // ── Game Analysis ─────────────────────────────────────────────────────────

  const requestAnalysis = useCallback(async () => {
    // Only analyze if there's history
    const history = state.game.history()
    if (history.length === 0) return

    setState(prev => ({ ...prev, isAnalyzing: true, error: null }))

    try {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: history, depth: 14 }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail ?? `Server error ${response.status}`)
      }

      const data: { analysis: MoveAnalysis[] } = await response.json()

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysis: data.analysis,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: `Analysis error: ${message}`,
      }))
    }
  }, [state.game])

  // ── Player Move ───────────────────────────────────────────────────────────

  const executeMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      const newGame = new Chess()
      newGame.loadPgn(state.game.pgn())
      let result
      try {
        result = newGame.move(move)
      } catch {
        return false
      }

      if (!result) return false

      // Check if player's move ended the game
      const localOver = checkLocalGameOver(newGame)
      if (localOver.over) {
        setState(prev => ({
          ...prev,
          game: newGame,
          gameStatus: resolveGameStatus(localOver.reason),
          gameOverReason: localOver.reason,
          pendingPromotion: null,
        }))
        return true
      }

      setState(prev => ({ ...prev, game: newGame, pendingPromotion: null }))

      // Trigger AI response
      requestAIMove(newGame, state.mode, state.targetElo)
      return true
    },
    [state.game, state.mode, state.targetElo, requestAIMove]
  )

  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (state.isThinking || state.gameStatus !== 'playing') return false

      // Check if this is a pawn promotion move
      const piece = state.game.get(sourceSquare)
      const isPawn = piece?.type === 'p'
      const isPromotion =
        isPawn &&
        ((piece.color === 'w' && targetSquare[1] === '8') ||
          (piece.color === 'b' && targetSquare[1] === '1'))

      if (isPromotion) {
        // Just verify if it's potentially legal (naive check)
        // We do this by trying to make the move with a queen
        const gameCopy = new Chess()
        gameCopy.loadPgn(state.game.pgn())
        try {
          const res = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
          if (res) {
            setState(prev => ({
              ...prev,
              pendingPromotion: { sourceSquare, targetSquare, color: piece.color },
            }))
            return true
          }
        } catch {
          return false
        }
        return false
      }

      // Normal move
      return executeMove({ from: sourceSquare, to: targetSquare })
    },
    [state.isThinking, state.gameStatus, state.game, executeMove]
  )

  const confirmPromotion = useCallback(
    (pieceType: PieceSymbol | null) => {
      if (!state.pendingPromotion) return

      if (!pieceType) {
        // Cancelled
        setState(prev => ({ ...prev, pendingPromotion: null }))
        return
      }

      executeMove({
        from: state.pendingPromotion.sourceSquare,
        to: state.pendingPromotion.targetSquare,
        promotion: pieceType,
      })
    },
    [state.pendingPromotion, executeMove]
  )

  // ── Controls ──────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    setState(prev => ({
      ...prev,
      game: new Chess(),
      isThinking: false,
      lastEval: null,
      lastPolicy: null,
      gameStatus: 'playing',
      gameOverReason: null,
      error: null,
      analysis: null,
    }))
  }, [])

  const resign = useCallback(() => {
    setState(prev => ({
      ...prev,
      gameStatus: 'resigned',
      gameOverReason: 'You resigned',
      isThinking: false,
    }))
  }, [])

  const setMode = useCallback((mode: EngineMode) => {
    setState(prev => ({ ...prev, mode }))
  }, [])

  const setTargetElo = useCallback((elo: number) => {
    setState(prev => ({ ...prev, targetElo: elo }))
  }, [])

  return {
    game: state.game,
    mode: state.mode,
    targetElo: state.targetElo,
    isThinking: state.isThinking,
    lastEval: state.lastEval,
    lastPolicy: state.lastPolicy,
    gameStatus: state.gameStatus,
    gameOverReason: state.gameOverReason,
    error: state.error,
    pendingPromotion: state.pendingPromotion,
    analysis: state.analysis,
    isAnalyzing: state.isAnalyzing,
    onDrop,
    resetGame,
    resign,
    setMode,
    setTargetElo,
    confirmPromotion,
    requestAnalysis,
  }
}
