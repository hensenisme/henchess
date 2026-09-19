import type { PieceSymbol } from 'chess.js'

interface PromotionModalProps {
  isOpen: boolean
  onSelect: (piece: PieceSymbol) => void
  onCancel: () => void
  color: 'w' | 'b'
}

const PIECES: { type: PieceSymbol; label: string; iconW: string; iconB: string }[] = [
  { type: 'q', label: 'Queen', iconW: '♕', iconB: '♛' },
  { type: 'r', label: 'Rook', iconW: '♖', iconB: '♜' },
  { type: 'b', label: 'Bishop', iconW: '♗', iconB: '♝' },
  { type: 'n', label: 'Knight', iconW: '♘', iconB: '♞' },
]

export function PromotionModal({ isOpen, onSelect, onCancel, color }: PromotionModalProps) {
  if (!isOpen) return null

  return (
    <div className="promotion-overlay" onClick={onCancel}>
      <div
        className="promotion-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Select promotion piece"
      >
        <h3 className="promotion-title">Promote Pawn</h3>
        <div className="promotion-pieces">
          {PIECES.map(piece => (
            <button
              key={piece.type}
              className="promotion-piece-btn"
              onClick={() => onSelect(piece.type)}
              aria-label={`Promote to ${piece.label}`}
              title={piece.label}
            >
              <span className="promotion-icon">
                {color === 'w' ? piece.iconW : piece.iconB}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
