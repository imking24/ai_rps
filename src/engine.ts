export const MOVES = ['rock', 'scissors', 'paper'] as const;
export type Move = typeof MOVES[number];
export type Difficulty = 'easy' | 'hard';
export type Target = 2 | 3 | 4;
export type Outcome = 'win' | 'loss' | 'draw';
export type Round = { number: number; player: Move; ai: Move; result: Outcome; playerScore: number; aiScore: number };
export type Match = { id: string; difficulty: Difficulty; target: Target; startedAt: string; endedAt?: string; phase: 'waiting' | 'revealing' | 'result' | 'finished'; lockedAI: Move; player: Move | null; rounds: Round[]; playerScore: number; aiScore: number };
export const LABELS: Record<Move, string> = { rock: '石头', scissors: '剪刀', paper: '布' };
export const MODES: Record<Target, string> = { 2: '三局两胜', 3: '五局三胜', 4: '七局四胜' };
export const OUTCOMES: Record<Outcome, string> = { win: '玩家获胜', loss: 'AI 获胜', draw: '本局平局' };
const COUNTER: Record<Move, Move> = { rock: 'paper', scissors: 'rock', paper: 'scissors' };

// Rejection sampling avoids modulo bias: every gesture has equal probability.
export function randomMove(): Move {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4294967295);
  return MOVES[value[0] % 3];
}
export function chooseAI(difficulty: Difficulty, history: readonly Round[], random = randomMove, noise = Math.random): Move {
  if (difficulty === 'easy' || history.length < 3 || noise() < 0.22) return random();
  const weights: Record<Move, number> = { rock: 1, scissors: 1, paper: 1 };
  const last = history[history.length - 1].player;
  const recent = history.slice(-18);
  recent.forEach((round, i) => {
    weights[round.player] += 1 + i / recent.length;
    // Completed historical transitions only; no current-round input exists here.
    if (i > 0 && recent[i - 1].player === last) weights[round.player] += 3;
  });
  const best = Math.max(...Object.values(weights));
  const predictions = MOVES.filter(move => weights[move] === best);
  return COUNTER[predictions[Math.min(predictions.length - 1, Math.floor(noise() * predictions.length))]];
}
export function judge(player: Move, ai: Move): Outcome {
  return player === ai ? 'draw' : COUNTER[ai] === player ? 'win' : 'loss';
}
export function startMatch(difficulty: Difficulty, target: Target): Match {
  return { id: crypto.randomUUID(), difficulty, target, startedAt: new Date().toISOString(), phase: 'waiting', lockedAI: chooseAI(difficulty, []), player: null, rounds: [], playerScore: 0, aiScore: 0 };
}
export function submitMove(match: Match, player: Move): Match {
  if (match.phase !== 'waiting' || !MOVES.includes(player)) return match;
  return { ...match, phase: 'revealing', player }; // lockedAI is immutable during submission.
}
export function reveal(match: Match): Match {
  if (match.phase !== 'revealing' || !match.player) return match;
  const result = judge(match.player, match.lockedAI);
  const playerScore = match.playerScore + Number(result === 'win');
  const aiScore = match.aiScore + Number(result === 'loss');
  const finished = playerScore === match.target || aiScore === match.target;
  return { ...match, playerScore, aiScore, phase: finished ? 'finished' : 'result', ...(finished ? { endedAt: new Date().toISOString() } : {}), rounds: [...match.rounds, { number: match.rounds.length + 1, player: match.player, ai: match.lockedAI, result, playerScore, aiScore }] };
}
export function nextRound(match: Match): Match {
  if (match.phase !== 'result') return match;
  return { ...match, phase: 'waiting', player: null, lockedAI: chooseAI(match.difficulty, match.rounds) };
}
export function isMatch(value: unknown): value is Match {
  if (!value || typeof value !== 'object') return false;
  const m = value as Match;
  if (typeof m.id !== 'string' || !['easy', 'hard'].includes(m.difficulty) || ![2,3,4].includes(m.target) || !['waiting','revealing','result','finished'].includes(m.phase) || !MOVES.includes(m.lockedAI) || !(m.player === null || MOVES.includes(m.player)) || !Array.isArray(m.rounds) || !Number.isFinite(Date.parse(m.startedAt))) return false;
  let player = 0, ai = 0;
  for (const [i, r] of m.rounds.entries()) {
    if (!r || player >= m.target || ai >= m.target || r.number !== i+1 || !MOVES.includes(r.player) || !MOVES.includes(r.ai) || judge(r.player,r.ai) !== r.result) return false;
    player += Number(r.result === 'win'); ai += Number(r.result === 'loss');
    if (r.playerScore !== player || r.aiScore !== ai) return false;
  }
  if (m.playerScore !== player || m.aiScore !== ai || (m.phase === 'finished') !== (Math.max(player,ai) === m.target)) return false;
  if (m.phase === 'waiting' && m.player !== null) return false;
  if (m.phase !== 'waiting' && m.player === null) return false;
  if (['result','finished'].includes(m.phase)) {
    const r=m.rounds.at(-1);
    if (!r || r.player !== m.player || r.ai !== m.lockedAI) return false;
  }
  return m.phase !== 'finished' || (typeof m.endedAt === 'string' && Number.isFinite(Date.parse(m.endedAt)));
}
