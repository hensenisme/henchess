"""
HenChess Backend — FastAPI server
Currently active engine: Stockfish
Maia3 requires PyTorch 2.4+ (needs Python 3.11+ environment upgrade).
"""

import logging
from contextlib import asynccontextmanager

import chess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engines.stockfish_engine import StockfishEngine
from engines.maia_engine import MaiaEngine
from engines.hybrid_selector import HybridSelector, DEFAULT_ALPHA
from engines.analysis_engine import get_analysis_engine, close_analysis_engine, analyze_game

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine singletons
# ---------------------------------------------------------------------------
stockfish = StockfishEngine()
maia = MaiaEngine()
hybrid = HybridSelector(stockfish, maia)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting HenChess engines…")
    stockfish.open()
    logger.info("Stockfish ready.")
    
    # Initialize analysis engine
    logger.info("Starting Analysis engine…")
    get_analysis_engine()
    
    # Initialize Maia in the background to avoid blocking server startup
    # (First run might take time to load model into RAM)
    logger.info("Starting Maia3 in background…")
    import threading
    threading.Thread(target=maia.open, daemon=True).start()
    
    logger.info("Server is live.")
    yield
    logger.info("Shutting down engines…")
    stockfish.close()
    maia.close()
    close_analysis_engine()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="HenChess API",
    description="Chess move engine — Stockfish active, Maia3 pending Python upgrade.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class MoveRequest(BaseModel):
    fen: str = Field(
        default="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="FEN string of the current board position.",
    )
    mode: str = Field(
        default="stockfish",
        description="Engine mode: 'stockfish', 'maia', or 'hybrid'. Maia/Hybrid fallback to Stockfish currently.",
    )
    target_elo: int = Field(
        default=1500,
        ge=800,
        le=2800,
        description="Target ELO (reserved for Maia integration).",
    )
    alpha: float = Field(
        default=DEFAULT_ALPHA,
        ge=0.0,
        le=1.0,
        description="Hybrid blend weight (reserved for Maia integration).",
    )


class MoveResponse(BaseModel):
    move: str | None
    eval: int | None = None
    policy: float | None = None
    mode: str = "unknown"
    actual_mode: str | None = None   # reveals fallback mode if applicable
    game_over: bool = False
    game_over_reason: str | None = None
    warning: str | None = None


class AnalyzeRequest(BaseModel):
    moves: list[str] = Field(
        ..., 
        description="List of UCI moves to analyze sequentially from the starting position."
    )
    depth: int = Field(
        default=14,
        description="Search depth for Stockfish evaluation."
    )


class AnalyzeResponse(BaseModel):
    analysis: list[dict]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/status", tags=["health"])
def get_status():
    """Health check — confirms engines are running."""
    return {
        "status": "ok",
        "stockfish_ready": stockfish.is_ready,
        "maia_ready": maia.is_ready,
    }


@app.post("/move", response_model=MoveResponse, tags=["engine"])
def get_move(request: MoveRequest):
    """
    Get the engine's chosen move for a given FEN position.
    Currently all modes (stockfish/maia/hybrid) use Stockfish.
    Maia3 will be enabled after Python environment upgrade to 3.11+.
    """
    try:
        board = chess.Board(request.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")

    if board.is_game_over():
        reason = _game_over_reason(board)
        return MoveResponse(
            move=None, game_over=True, game_over_reason=reason, mode=request.mode
        )

    mode = request.mode.lower()
    warning = None

    # Ensure engines are ready
    if not stockfish.is_ready:
        raise HTTPException(status_code=503, detail="Stockfish not ready")
        
    # Fallback to stockfish if maia is requested but still loading
    if mode in ("maia", "hybrid") and not maia.is_ready:
        warning = "Maia3 is still loading/downloading in background. Falling back to Stockfish."
        logger.info(warning)
        result = stockfish.get_best_move(request.fen, depth=15)
        if not result["move"]:
            return MoveResponse(move=None, game_over=True, mode=mode, warning=warning)
        return MoveResponse(
            move=result["move"],
            eval=result["eval"],
            mode=request.mode,
            actual_mode="stockfish",
            warning=warning,
        )

    try:
        if mode == "maia":
            result = maia.get_move_with_policy(request.fen, target_elo=request.target_elo)
            if not result["best_move"]:
                return MoveResponse(move=None, game_over=True, mode=mode)
            
            return MoveResponse(
                move=result["best_move"],
                policy=result["policy"][0]["policy"] if result["policy"] else None,
                mode=mode,
                actual_mode="maia",
            )
            
        elif mode == "hybrid":
            result = hybrid.get_hybrid_move(
                fen=request.fen,
                target_elo=request.target_elo,
                alpha=request.alpha,
                depth=15
            )
            if not result["move"]:
                return MoveResponse(move=None, game_over=True, mode=mode)
            
            return MoveResponse(
                move=result["move"],
                eval=result["eval"],
                policy=result["policy"],
                mode=mode,
                actual_mode="hybrid",
            )
            
        else: # stockfish
            result = stockfish.get_best_move(request.fen, depth=15)
            if not result["move"]:
                return MoveResponse(move=None, game_over=True, mode=mode)

            return MoveResponse(
                move=result["move"],
                eval=result["eval"],
                mode=mode,
                actual_mode="stockfish",
            )

    except RuntimeError as e:
        logger.error(f"Engine error: {e}")
        raise HTTPException(status_code=503, detail=f"Engine error: {e}")
    except Exception as e:
        logger.exception("Unexpected error during /move")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.post("/analyze", response_model=AnalyzeResponse, tags=["analysis"])
def post_analyze(request: AnalyzeRequest):
    """
    Analyze a full sequence of moves and classify each move.
    """
    try:
        results = analyze_game(request.moves, depth=request.depth)
        return AnalyzeResponse(analysis=results)
    except Exception as e:
        logger.exception("Unexpected error during /analyze")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _game_over_reason(board: chess.Board) -> str:
    if board.is_checkmate():
        winner = "Black" if board.turn == chess.WHITE else "White"
        return f"Checkmate — {winner} wins"
    if board.is_stalemate():
        return "Stalemate"
    if board.is_insufficient_material():
        return "Draw — Insufficient material"
    if board.is_seventyfive_moves():
        return "Draw — 75-move rule"
    if board.is_fivefold_repetition():
        return "Draw — Fivefold repetition"
    return "Game over"
