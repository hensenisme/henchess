export type UiTheme = 'dark' | 'light'
export type BoardColor = 'blue' | 'green' | 'brown'
export type PieceTheme = 'standard' | 'alpha' | 'merida'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  uiTheme: UiTheme
  setUiTheme: (t: UiTheme) => void
  boardColor: BoardColor
  setBoardColor: (c: BoardColor) => void
  pieceTheme: PieceTheme
  setPieceTheme: (p: PieceTheme) => void
}

export function SettingsModal({
  isOpen,
  onClose,
  uiTheme,
  setUiTheme,
  boardColor,
  setBoardColor,
  pieceTheme,
  setPieceTheme
}: SettingsModalProps) {
  if (!isOpen) return null

  return (
    <div className="game-over-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div 
        className="game-over-card" 
        onClick={e => e.stopPropagation()}
        style={{ width: '400px', textAlign: 'left', padding: '24px 32px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>⚙️ Settings</h2>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </div>

        {/* UI Theme */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            UI Theme
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`mode-btn ${uiTheme === 'dark' ? 'mode-btn--active' : ''}`}
              onClick={() => setUiTheme('dark')}
            >
              🌙 Dark
            </button>
            <button 
              className={`mode-btn ${uiTheme === 'light' ? 'mode-btn--active' : ''}`}
              onClick={() => setUiTheme('light')}
            >
              ☀️ Light
            </button>
          </div>
        </div>

        {/* Board Color */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Board Color
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`mode-btn ${boardColor === 'blue' ? 'mode-btn--active' : ''}`}
              onClick={() => setBoardColor('blue')}
            >
              🟦 Blue
            </button>
            <button 
              className={`mode-btn ${boardColor === 'green' ? 'mode-btn--active' : ''}`}
              onClick={() => setBoardColor('green')}
            >
              🟩 Green
            </button>
            <button 
              className={`mode-btn ${boardColor === 'brown' ? 'mode-btn--active' : ''}`}
              onClick={() => setBoardColor('brown')}
            >
              🟫 Brown
            </button>
          </div>
        </div>

        {/* Piece Theme */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Piece Style
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`mode-btn ${pieceTheme === 'standard' ? 'mode-btn--active' : ''}`}
              onClick={() => setPieceTheme('standard')}
            >
              Standard
            </button>
            <button 
              className={`mode-btn ${pieceTheme === 'alpha' ? 'mode-btn--active' : ''}`}
              onClick={() => setPieceTheme('alpha')}
            >
              Alpha
            </button>
            <button 
              className={`mode-btn ${pieceTheme === 'merida' ? 'mode-btn--active' : ''}`}
              onClick={() => setPieceTheme('merida')}
            >
              Merida
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
