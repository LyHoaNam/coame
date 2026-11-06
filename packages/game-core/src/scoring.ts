import type { Match, MatchResult, Score } from './model.js';
export function rankPairs(scores: readonly Score[]): Score[] {
  return scores.filter(s => s.count > 0).map(s => ({ ...s })).sort((a, b) => b.count - a.count || a.reachedEventSeq - b.reachedEventSeq);
}
export function leaderboard(scores: readonly Score[]): Score[] {
  const seen = new Set<string>();
  return rankPairs(scores).filter(row => { if (seen.has(row.playerId)) return false; seen.add(row.playerId); return true; });
}
export function finalizeMatch(match: Match): MatchResult {
  if (match.result) return match.result;
  const scores = rankPairs(match.scores);
  match.result = structuredClone({ resultId: `${match.matchId}:result`, matchId: match.matchId, winner: scores[0] ?? null, scores, roster: match.roster, foods: match.config.foods });
  match.items = [];
  return match.result;
}
