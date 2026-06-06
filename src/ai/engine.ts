import type { GameState, Player } from '../game/types';
import { getQueenMoves, buildBlockedSet } from '../game/rules';
import { useServerStore } from '../store/server-store';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

// Default URLs — overridden at runtime by server-store config
const DEFAULT_API_URL = import.meta.env.VITE_AI_API_URL ?? 'http://127.0.0.1:8000/v1/chat/completions';
const DEFAULT_MODEL = import.meta.env.VITE_AI_MODEL ?? 'Qwen/Qwen3.6-35B-A3B-FP8';

/** Get the currently configured API URL (runtime config takes priority over build-time env) */
function getApiUrl(): string {
  try {
    const url = useServerStore.getState().serverUrl;
    if (url) return url;
  } catch {
    // Fallback if store not initialized
  }
  return DEFAULT_API_URL;
}

/** Build a text representation of the board */
function boardToString(state: GameState): string {
  const size = state.boardSize;
  const cols = '   ' + Array.from({ length: size }, (_, i) => String.fromCharCode(65 + i)).join(' ');
  const lines: string[] = [cols];

  for (let r = 0; r < size; r++) {
    const rowLabel = String(size - r).padStart(2, ' ');
    const cells: string[] = [];
    for (let c = 0; c < size; c++) {
      const amazon = state.amazons.find(a => a.position.row === r && a.position.col === c);
      if (amazon) {
        cells.push(amazon.player === 'white' ? 'W' : 'B');
      } else if (state.burnedCells.some(b => b.row === r && b.col === c)) {
        cells.push('#');
      } else {
        cells.push('.');
      }
    }
    lines.push(rowLabel + ' ' + cells.join(' '));
  }
  return lines.join('\n');
}

interface AIMove {
  /** Amazon position to move */
  fromRow: number;
  fromCol: number;
  /** Destination */
  toRow: number;
  toCol: number;
  /** Arrow target */
  arrowRow: number;
  arrowCol: number;
}

/** Build the system prompt for the AI */
function buildSystemPrompt(difficulty: AIDifficulty, player: Player, boardSize: number): string {
  const opponent = player === 'white' ? 'black' : 'white';
  return `You are playing the Game of the Amazons as the ${player} player. Your opponent is ${opponent}.

RULES:
- The board columns are A-${String.fromCharCode(64 + boardSize)} and rows are 1-${boardSize}.
- W = your amazon, B = opponent amazon, # = burned (blocked), . = empty
- On your turn you must: 1) Move one of your amazons (like a chess queen — any distance horizontally, vertically, or diagonally through empty squares). 2) From the new position, shoot an arrow (also like a queen) to burn a square.
- You CANNOT move through or land on other amazons or burned squares.
- The last player who can make a valid move wins. Plan ahead to trap your opponent.

STRATEGY (${difficulty === 'hard' ? 'EXPERT LEVEL' : difficulty === 'medium' ? 'INTERMEDIATE LEVEL' : 'BASIC LEVEL'}):
${difficulty === 'hard' ? `
- Think 3-4 moves ahead. Identify the opponent's most mobile amazon and try to block it.
- Prefer moves that give your amazon continued mobility while restricting opponent options.
- Consider which squares, if burned, would split the opponent's territory.
- Look for moves that force the opponent into a corner with limited escape routes.
- Evaluate all your amazons before choosing which to move.
` : difficulty === 'medium' ? `
- Think 1-2 moves ahead. Try to maintain central board control.
- Avoid moving your amazons into corners where they get trapped.
- Try to burn squares near the opponent's amazons to limit their mobility.
` : `
- Focus on keeping your amazons in open areas with many movement options.
- Try to burn squares near the opponent's amazons.
- Avoid obvious bad moves that trap your own pieces.
`}

OUTPUT FORMAT: Reply EXACTLY with one line in this format (no explanation):
MOVE: <from_col><from_row> -> <to_col><to_row> -> <arrow_col><arrow_row>
Example: MOVE: B2 -> D2 -> F2`;
}

function parseAIResponse(text: string, size: number): AIMove | null {
  // Try to find the move line
  const patterns = [
    /MOVE:\s*([A-Z])(\d+)\s*->\s*([A-Z])(\d+)\s*->\s*([A-Z])(\d+)/i,
    /([A-Z])(\d+)\s*[-–>]+\s*([A-Z])(\d+)\s*[-–>]+\s*([A-Z])(\d+)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const fromCol = m[1].toUpperCase().charCodeAt(0) - 65;
      const fromRow = size - parseInt(m[2]);
      const toCol = m[3].toUpperCase().charCodeAt(0) - 65;
      const toRow = size - parseInt(m[4]);
      const arrowCol = m[5].toUpperCase().charCodeAt(0) - 65;
      const arrowRow = size - parseInt(m[6]);

      // Basic bounds check
      if ([fromRow, toRow, arrowRow].every(r => r >= 0 && r < size) &&
          [fromCol, toCol, arrowCol].every(c => c >= 0 && c < size)) {
        return { fromRow, fromCol, toRow, toCol, arrowRow, arrowCol };
      }
    }
  }
  return null;
}

/** Temperature by difficulty */
function difficultyTemp(d: AIDifficulty): number {
  return d === 'easy' ? 0.3 : d === 'medium' ? 0.5 : 0.7;
}

/** Request a move from the vLLM model */
async function requestMove(
  boardStr: string,
  difficulty: AIDifficulty,
  player: Player,
  boardSize: number,
  signal?: AbortSignal,
): Promise<string> {
  const system = buildSystemPrompt(difficulty, player, boardSize);
  const userMsg = `Current board state (${player} to move):\n\n${boardStr}\n\nChoose the best move for ${player}. Reply with the MOVE: format only.`;

  const res = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      max_tokens: difficulty === 'hard' ? 800 : difficulty === 'medium' ? 500 : 200,
      temperature: difficultyTemp(difficulty),
      stop: ['</s>', '\n\n\n'],
    }),
    signal,
  });

  if (!res.ok) throw new Error(`vLLM API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Public API ──

/** Check if an AI move is valid for the given state */
function isValidMove(state: GameState, move: AIMove): boolean {
  const amazon = state.amazons.find(
    a => a.position.row === move.fromRow && a.position.col === move.fromCol && a.player === state.currentPlayer,
  );
  if (!amazon) return false;

  // Check move legality
  const blocked = buildBlockedSet(state.amazons, state.burnedCells);
  const validMoves = getQueenMoves(amazon.position, state.boardSize, blocked);
  if (!validMoves.some(p => p.row === move.toRow && p.col === move.toCol)) return false;

  // Check shot legality
  const tempAmazons = state.amazons.map(a =>
    a.id === amazon.id ? { ...a, position: { row: move.toRow, col: move.toCol } } : a,
  );
  const newBlocked = buildBlockedSet(tempAmazons, state.burnedCells);
  const validShots = getQueenMoves({ row: move.toRow, col: move.toCol }, state.boardSize, newBlocked);
  if (!validShots.some(p => p.row === move.arrowRow && p.col === move.arrowCol)) return false;

  return true;
}

/** Request an AI move, with retry for invalid responses */
export async function getAIMove(
  state: GameState,
  difficulty: AIDifficulty,
  maxRetries = 2,
  timeoutMs = 25000,
  signal?: AbortSignal,
): Promise<AIMove | null> {
  const boardStr = boardToString(state);
  const player = state.currentPlayer;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const text = await requestMove(boardStr, difficulty, player, state.boardSize, controller.signal);
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);

      const move = parseAIResponse(text, state.boardSize);
      if (move && isValidMove(state, move)) {
        console.log(`AI (${difficulty}) move accepted on attempt ${attempt + 1}`);
        return move;
      }
      console.warn(`AI move invalid, retry ${attempt + 1}/${maxRetries}`);
    } catch (err: unknown) {
      if (signal?.aborted) return null;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`AI request failed (attempt ${attempt + 1}):`, message);
    }
  }

  // Fallback: use random move
  console.warn('AI falling back to random move');
  return getRandomMove(state);
}

/** Fallback: pick a random valid move */
export function getRandomMove(state: GameState): AIMove | null {
  const player = state.currentPlayer;
  const playerAmazons = state.amazons.filter(a => a.player === player);
  if (playerAmazons.length === 0) return null;

  const blocked = buildBlockedSet(state.amazons, state.burnedCells);
  const opponentAmazons = state.amazons.filter(a => a.player !== player);
  let best: { move: AIMove; score: number } | null = null;

  for (const amazon of playerAmazons) {
    const moves = getQueenMoves(amazon.position, state.boardSize, blocked);
    if (moves.length === 0) continue;

    for (const moveTo of moves) {
      const tempAmazons = state.amazons.map(a =>
        a.id === amazon.id ? { ...a, position: { row: moveTo.row, col: moveTo.col } } : a,
      );
      const newBlocked = buildBlockedSet(tempAmazons, state.burnedCells);
      const shots = getQueenMoves(moveTo, state.boardSize, newBlocked);
      if (shots.length === 0) continue;

      for (const shot of shots) {
        const nearestOpponent = opponentAmazons.reduce<number>((nearest, opp) => {
          const dist = Math.max(Math.abs(shot.row - opp.position.row), Math.abs(shot.col - opp.position.col));
          return Math.min(nearest, dist);
        }, state.boardSize);
        const center = (state.boardSize - 1) / 2;
        const centerDistance = Math.abs(moveTo.row - center) + Math.abs(moveTo.col - center);
        const score = shots.length * 2 - centerDistance - nearestOpponent * 0.6 + Math.random() * 0.01;
        if (!best || score > best.score) {
          best = {
            score,
            move: {
              fromRow: amazon.position.row, fromCol: amazon.position.col,
              toRow: moveTo.row, toCol: moveTo.col,
              arrowRow: shot.row, arrowCol: shot.col,
            },
          };
        }
      }
    }
  }

  return best?.move ?? null;
}
