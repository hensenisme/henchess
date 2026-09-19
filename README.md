# HenChess

HenChess is a web-based chess application featuring a Hybrid AI Sparring Engine. It allows users to play against a computer opponent that blends the objective strength of **Stockfish 18** with the human-like playing style of **Maia3**.

## Features

*   **3 AI Modes**:
    *   **Stockfish**: Pure, uncompromising engine play.
    *   **Maia**: Human-like play designed to mimic real human players at specific Elo ratings.
    *   **Hybrid**: A custom algorithm that combines Stockfish's multi-PV analysis with Maia's policy probabilities, producing moves that are both strong and human-like.
*   **Target Elo**: Adjust the target Elo (from 1100 to 1900) to match your skill level.
*   **Post-Game Analysis**: Receive a detailed evaluation of your game with Brilliant, Great, Mistake, and Blunder badges—just like popular online chess platforms.
*   **Interactive Board**: Supports both Drag-and-Drop and Click-to-Move input styles.
*   **Visual Move Indicators**: Instantly highlights valid destination squares when you select a piece.
*   **Modern UI**: Built with React and Vite for a seamless, fast experience.

## Technology Stack

*   **Frontend**: React (v18), TypeScript, Vite, `react-chessboard` (v5), `chess.js` (v1.4.0)
*   **Backend**: Python 3.11, FastAPI, `python-chess`, Uvicorn
*   **Engines**: Stockfish 18 (C++), Maia3 (PyTorch)

## Setup and Installation

### Prerequisites
*   Node.js (v16+)
*   Python (3.11 recommended)
*   Stockfish (must be installed on the system, default path `/usr/local/bin/stockfish`)

### Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment and activate it:
    ```bash
    python3.11 -m venv venv
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the backend server:
    ```bash
    uvicorn main:app --reload --port 8000
    ```

### Frontend Setup
1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```

## Usage
Open `http://localhost:5173` in your browser. Select your preferred AI Mode and Target Elo from the sidebar, then make your first move! After a game concludes, click **Analyze Game** to review the match's statistics and evaluation.

## License
MIT
