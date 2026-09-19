"""
Hybrid Selector for HenChess.

Combines Stockfish's objective evaluation (MultiPV) with Maia3's
human-like policy distribution to select moves that are both
strong AND plausible for a human at a given ELO.

Algorithm:
    1. Get top-N candidate moves from Stockfish (MultiPV)
    2. Score each candidate using Maia3's policy probability
    3. Compute: hybrid_score = (1 - alpha) * sf_score_norm + alpha * maia_policy
    4. Return the candidate with the highest hybrid_score

alpha=0.0  → Pure Stockfish (engine-like)
alpha=1.0  → Pure Maia (human-like)
alpha=0.6  → Default — strong but human-feeling play
"""

import logging
from typing import Optional
from .stockfish_engine import StockfishEngine
from .maia_engine import MaiaEngine

logger = logging.getLogger(__name__)

DEFAULT_ALPHA = 0.6
STOCKFISH_MULTIPV = 5  # Number of Stockfish candidates to consider


class HybridSelector:
    def __init__(self, stockfish: StockfishEngine, maia: MaiaEngine):
        self.stockfish = stockfish
        self.maia = maia

    def get_hybrid_move(self, fen: str, target_elo: int, alpha: float, depth: int = 15) -> dict:
        sf_moves = self.stockfish.get_multipv(fen, depth=depth, num_moves=STOCKFISH_MULTIPV)
        if not sf_moves:
            return {"move": None, "eval": None, "policy": None}

        # Need to parse maia_policy. Maia returns a dict: {"best_move": str, "policy": list}
        maia_res = self.maia.get_move_with_policy(fen, target_elo=target_elo, multipv=10)
        maia_policy = maia_res.get("policy", [])

        return select_hybrid_move(sf_moves, maia_policy, alpha=alpha)


def select_hybrid_move(
    sf_moves: list[dict],
    maia_policy: list[dict],
    alpha: float = DEFAULT_ALPHA,
) -> dict:
    """
    Select the best hybrid move.

    Args:
        sf_moves: List of Stockfish MultiPV results [{move, eval}, ...]
                  sorted best-first (highest eval for current side)
        maia_policy: List of Maia policy results [{move, policy}, ...]
                     sorted by policy probability descending
        alpha: Weight for Maia policy (0=pure Stockfish, 1=pure Maia)

    Returns:
        dict: {move, eval, policy, hybrid_score}
    """
    if not sf_moves:
        raise ValueError("No Stockfish candidates provided.")

    # Build a lookup map from move UCI → maia policy prob
    maia_lookup: dict[str, float] = {
        item["move"]: item["policy"] for item in maia_policy
    }

    # Normalize Stockfish evals to [0, 1] range
    sf_normalized = _normalize_evals([m["eval"] for m in sf_moves])

    best_candidate: Optional[dict] = None
    best_score: float = -1.0

    for sf_move, sf_norm in zip(sf_moves, sf_normalized):
        move_uci = sf_move["move"]

        # Maia policy for this move (0 if not in Maia's top moves)
        maia_prob = maia_lookup.get(move_uci, 0.0)

        hybrid_score = (1 - alpha) * sf_norm + alpha * maia_prob

        logger.debug(
            f"Move {move_uci}: sf_norm={sf_norm:.3f}, "
            f"maia={maia_prob:.3f}, hybrid={hybrid_score:.3f}"
        )

        if hybrid_score > best_score:
            best_score = hybrid_score
            best_candidate = {
                "move": move_uci,
                "eval": sf_move["eval"],
                "policy": round(maia_prob, 4),
                "hybrid_score": round(hybrid_score, 4),
            }

    # Fallback: if no candidate found (shouldn't happen), return Stockfish's best
    if best_candidate is None:
        fallback = sf_moves[0]
        best_candidate = {
            "move": fallback["move"],
            "eval": fallback["eval"],
            "policy": 0.0,
            "hybrid_score": 0.0,
        }

    return best_candidate


def _normalize_evals(evals: list[int]) -> list[float]:
    """
    Normalize centipawn evaluations to [0, 1] using sigmoid-like mapping.
    Uses tanh(eval / 400) so ±400cp maps to ±0.76 range.
    Output is shifted to [0, 1] where 1 = best move.
    """
    import math

    if not evals:
        return []

    # tanh normalization: maps centipawns to (-1, 1)
    raw = [math.tanh(e / 400.0) for e in evals]

    # Shift to [0, 1]
    min_val = min(raw)
    max_val = max(raw)
    span = max_val - min_val

    if span < 1e-9:
        # All evals are identical — distribute equally
        return [1.0 / len(evals)] * len(evals)

    # Normalize so best move (highest raw) gets 1.0
    return [(r - min_val) / span for r in raw]
