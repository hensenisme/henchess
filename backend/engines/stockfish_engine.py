"""
Stockfish engine wrapper for HenChess.
Manages a single persistent Stockfish process shared across all requests.
"""

import chess
import chess.engine
import logging
from typing import Optional

logger = logging.getLogger(__name__)

STOCKFISH_PATH = "/usr/local/bin/stockfish"


class StockfishEngine:
    """
    Thread-safe wrapper around a persistent Stockfish subprocess.
    Must be used as an async context manager or call open()/close() explicitly.
    """

    def __init__(self, path: str = STOCKFISH_PATH):
        self.path = path
        self._engine: Optional[chess.engine.SimpleEngine] = None

    def open(self):
        """Start the Stockfish process."""
        logger.info(f"Starting Stockfish from {self.path}")
        self._engine = chess.engine.SimpleEngine.popen_uci(self.path)
        logger.info("Stockfish ready.")

    def close(self):
        """Terminate the Stockfish process gracefully."""
        if self._engine:
            try:
                self._engine.quit()
            except Exception:
                pass
            self._engine = None
            logger.info("Stockfish closed.")

    @property
    def is_ready(self) -> bool:
        return self._engine is not None

    def get_best_move(self, fen: str, depth: int = 15) -> dict:
        """
        Return the single best move for a given FEN position.

        Returns:
            dict with keys: move (UCI str), eval (centipawns)
        """
        if not self._engine:
            raise RuntimeError("Stockfish engine is not initialized.")

        board = chess.Board(fen)
        if board.is_game_over():
            return {"move": None, "eval": 0}

        result = self._engine.analyse(
            board,
            chess.engine.Limit(depth=depth),
            info=chess.engine.INFO_SCORE | chess.engine.INFO_PV,
        )

        move = result.get("pv", [None])[0]
        score = result.get("score")
        eval_cp = _score_to_cp(score, board.turn)

        return {
            "move": move.uci() if move else None,
            "eval": eval_cp,
        }

    def get_multipv(self, fen: str, num_moves: int = 5, depth: int = 12) -> list[dict]:
        """
        Return top-N moves with evaluations using Stockfish MultiPV.

        Returns:
            List of dicts: [{move, eval, pv}, ...]  sorted best-first
        """
        if not self._engine:
            raise RuntimeError("Stockfish engine is not initialized.")

        board = chess.Board(fen)
        if board.is_game_over():
            return []

        legal_count = board.legal_moves.count()
        actual_multipv = min(num_moves, legal_count)
        if actual_multipv == 0:
            return []

        results = self._engine.analyse(
            board,
            chess.engine.Limit(depth=depth),
            multipv=actual_multipv,
            info=chess.engine.INFO_ALL,
        )

        # analyse() returns a list when multipv > 1
        if not isinstance(results, list):
            results = [results]

        moves = []
        for info in results:
            pv = info.get("pv", [])
            if not pv:
                continue
            move = pv[0]
            score = info.get("score")
            eval_cp = _score_to_cp(score, board.turn)
            moves.append({
                "move": move.uci(),
                "eval": eval_cp,
            })

        return moves


def _score_to_cp(score: Optional[chess.engine.PovScore], turn: chess.Color) -> int:
    """
    Convert a PovScore to centipawns from White's perspective.
    Mate scores are capped at ±9999.
    """
    if score is None:
        return 0

    white_score = score.white()
    if white_score.is_mate():
        mate_in = white_score.mate()
        return 9999 if mate_in > 0 else -9999

    cp = white_score.score()
    return cp if cp is not None else 0
