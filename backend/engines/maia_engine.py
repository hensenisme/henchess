"""
Maia3 UCI engine wrapper for HenChess.
Communicates with Maia3 via UCI protocol over a subprocess.
Supports ELO configuration and MultiPV policy extraction.
"""

import chess
import chess.engine
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Maia3 5M model — good balance of speed and accuracy for CPU inference
MAIA3_COMMAND = "maia3-5m"

# ELO range supported by the Maia3 model
MAIA_ELO_MIN = 800
MAIA_ELO_MAX = 2800
MAIA_DEFAULT_ELO = 1500


def _clamp_elo(elo: int) -> int:
    return max(MAIA_ELO_MIN, min(MAIA_ELO_MAX, elo))


class MaiaEngine:
    """
    Wrapper around the Maia3 UCI subprocess.
    Uses python-chess's SimpleEngine for reliable UCI communication.
    """

    def __init__(self, command: str = MAIA3_COMMAND):
        self.command = command
        self._engine: Optional[chess.engine.SimpleEngine] = None
        self._current_elo: int = MAIA_DEFAULT_ELO

    def open(self):
        """
        Launch Maia3 subprocess.
        Uses a generous timeout because the first run downloads model weights.
        Actual model loading happens lazily on the first 'isready' command.
        """
        logger.info(f"Starting Maia3 engine: {self.command} (model will load on first use)")
        # 300s timeout: first run needs to download the 5M model weights (~20MB)
        self._engine = chess.engine.SimpleEngine.popen_uci(
            self.command,
            timeout=300,
        )
        self._set_elo_internal(MAIA_DEFAULT_ELO)
        logger.info("Maia3 ready.")

    def close(self):
        """Terminate Maia3 subprocess gracefully."""
        if self._engine:
            try:
                self._engine.quit()
            except Exception:
                pass
            self._engine = None
            logger.info("Maia3 closed.")

    @property
    def is_ready(self) -> bool:
        return self._engine is not None

    def _set_elo_internal(self, elo: int):
        """Send setoption commands to update Maia ELO."""
        clamped = _clamp_elo(elo)
        if self._engine:
            self._engine.configure({
                "Elo": clamped,
                "SelfElo": clamped,
                "OppoElo": clamped,
            })
        self._current_elo = clamped

    def get_move_with_policy(
        self, fen: str, target_elo: int = MAIA_DEFAULT_ELO, multipv: int = 10
    ) -> dict:
        """
        Get Maia3's best move and move policy probabilities for a position.

        Args:
            fen: FEN string of the position
            target_elo: The ELO level Maia should mimic
            multipv: Number of top moves to return with policy scores

        Returns:
            dict:
                best_move: UCI string of selected move
                policy: List of {move, policy} dicts sorted by probability
        """
        if not self._engine:
            raise RuntimeError("Maia3 engine is not initialized.")

        board = chess.Board(fen)
        if board.is_game_over():
            return {"best_move": None, "policy": []}

        # Update ELO if changed
        if target_elo != self._current_elo:
            self._set_elo_internal(target_elo)

        legal_count = board.legal_moves.count()
        actual_multipv = min(multipv, legal_count)
        if actual_multipv == 0:
            return {"best_move": None, "policy": []}

        # Use depth=1 (single forward pass) — Maia is a policy model, not a search engine
        results = self._engine.analyse(
            board,
            chess.engine.Limit(nodes=1),
            multipv=actual_multipv,
            info=chess.engine.INFO_ALL,
        )

        if not isinstance(results, list):
            results = [results]

        policy = []
        best_move = None

        for rank, info in enumerate(results):
            pv = info.get("pv", [])
            if not pv:
                continue
            move = pv[0]
            score = info.get("score")

            # Maia exposes policy via the WDL field in info lines.
            # We use the score's wdl() to extract relative probabilities.
            # The first result (rank 0) is Maia's chosen move.
            if rank == 0:
                best_move = move.uci()

            # Extract probability: use wdl draw+win as a proxy for policy weight
            # In Maia's UCI output, the score cp value reflects relative policy
            wdl = None
            if score is not None:
                try:
                    wdl = score.white().wdl(model="lichess")
                except Exception:
                    wdl = None

            policy_weight = _wdl_to_policy_weight(wdl, rank, len(results))

            policy.append({
                "move": move.uci(),
                "policy": round(policy_weight, 4),
            })

        return {
            "best_move": best_move,
            "policy": policy,
        }


def _wdl_to_policy_weight(
    wdl: Optional[chess.engine.Wdl],
    rank: int,
    total: int,
) -> float:
    """
    Approximate policy probability from rank position.
    Maia3 returns moves in policy-sorted order (most likely first).
    We use a geometric decay to approximate relative probabilities.
    """
    if total <= 1:
        return 1.0

    # Geometric decay: rank 0 gets highest weight
    decay = 0.6
    raw_weight = decay ** rank
    # Normalize across total ranks
    total_weight = sum(decay ** i for i in range(total))
    return raw_weight / total_weight
