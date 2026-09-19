"""
Analysis Engine for HenChess.
Runs Stockfish on a list of moves to generate evaluations and move classifications.
"""

import chess
import logging
from typing import Optional
from engines.stockfish_engine import StockfishEngine

logger = logging.getLogger(__name__)

# Re-use the existing stockfish instance logic or create a new one for analysis
# To avoid blocking the main playing engine, it's often better to have a dedicated instance,
# but for MVP we can just use a local instance.
_analysis_sf: Optional[StockfishEngine] = None

def get_analysis_engine() -> StockfishEngine:
    global _analysis_sf
    if _analysis_sf is None:
        _analysis_sf = StockfishEngine()
        _analysis_sf.open()
    return _analysis_sf

def close_analysis_engine():
    global _analysis_sf
    if _analysis_sf is not None:
        _analysis_sf.close()
        _analysis_sf = None


def classify_move(delta: int) -> dict:
    """
    Classifies a move based on centipawn loss/gain from the perspective of the player making the move.
    Delta = eval_after - eval_before.
    Since eval is always from White's perspective in Stockfish absolute terms,
    we must ensure the delta reflects the player's perspective.
    Wait, let's define delta from the perspective of the player who just moved.
    Actually, delta = (eval_after - eval_before) if White moved, else (eval_before - eval_after).
    """
    # A positive delta means the evaluation improved for the player who just moved.
    # A negative delta means the evaluation worsened (mistake/blunder).
    if delta >= 300:
        return {"label": "Brilliant", "color": "blue", "icon": "✨"}
    elif delta >= 50:
        return {"label": "Great", "color": "green", "icon": "✓✓"}
    elif delta >= -20:
        return {"label": "Good", "color": "lightgreen", "icon": "✓"}
    elif delta >= -100:
        return {"label": "Inaccuracy", "color": "yellow", "icon": "⚠"}
    elif delta >= -300:
        return {"label": "Mistake", "color": "orange", "icon": "❌"}
    else:
        return {"label": "Blunder", "color": "red", "icon": "⚡"}


def analyze_game(moves: list[str], depth: int = 14) -> list[dict]:
    """
    Analyze a sequence of UCI moves.
    Returns a list of analysis dicts for each move.
    """
    engine = get_analysis_engine()
    board = chess.Board()
    
    # Get initial evaluation
    res = engine.get_best_move(board.fen(), depth=depth)
    current_eval = res["eval"] or 0
    
    analysis_results = []
    
    for uci_move in moves:
        fen_before = board.fen()
        turn = board.turn # True for White, False for Black
        
        # Make the move
        try:
            # The frontend sends history as SAN (e.g. 'e4', 'Nf3')
            try:
                move = board.parse_san(uci_move)
            except ValueError:
                # Fallback to UCI just in case
                move = chess.Move.from_uci(uci_move)
                
            if move not in board.legal_moves:
                logger.warning(f"Illegal move {uci_move} in sequence")
                break
            
            san_str = board.san(move) # capture SAN before pushing
            board.push(move)
        except Exception as e:
            logger.warning(f"Invalid move {uci_move}: {e}")
            break
            
        fen_after = board.fen()
        
        # Evaluate new position
        res = engine.get_best_move(fen_after, depth=depth)
        next_eval = res["eval"] or 0
        
        # Calculate delta from the perspective of the player who just moved
        # If White moved (turn == True), they want eval to increase.
        # If Black moved (turn == False), they want eval to decrease (become more negative).
        if turn == chess.WHITE:
            delta = next_eval - current_eval
        else:
            delta = current_eval - next_eval
            
        classification = classify_move(delta)
        
        analysis_results.append({
            "move": uci_move,
            "san": san_str,
            "fen_before": fen_before,
            "fen_after": fen_after,
            "eval_before": current_eval,
            "eval_after": next_eval,
            "delta": delta,
            "classification": classification
        })
        
        current_eval = next_eval
        
    return analysis_results
