/**
 * MODULE 8.1 — CANONICAL LEVEL & PROGRESSION ENGINE
 * 
 * Deterministic progressive leveling curve and tier structure:
 * - 100 base + 50 per level:
 *   Threshold(L) = 25 * (L - 1) * (L + 2)
 *   L = floor((sqrt(9 + 0.16 * XP) - 1) / 2)
 * 
 * Tiers:
 * - Novice (Lvl 1–4)
 * - Apprentice (Lvl 5–9)
 * - Specialist (Lvl 10–19)
 * - Expert (Lvl 20–29)
 * - Master (Lvl 30–39)
 * - Grandmaster (Lvl 40+)
 */

export type LevelTierTitle =
  | 'Novice'
  | 'Apprentice'
  | 'Specialist'
  | 'Expert'
  | 'Master'
  | 'Grandmaster'

export interface LevelProgress {
  level: number
  title: LevelTierTitle
  totalXp: number
  currentLevelXp: number
  nextLevelXp: number
  xpInLevel: number
  xpRequired: number
  progressPercentage: number
}

/**
 * Deterministic pure helper to derive level tier title
 */
export function getLevelTierTitle(level: number): LevelTierTitle {
  if (level <= 4) return 'Novice'
  if (level <= 9) return 'Apprentice'
  if (level <= 19) return 'Specialist'
  if (level <= 29) return 'Expert'
  if (level <= 39) return 'Master'
  return 'Grandmaster'
}

/**
 * Calculates complete canonical level progression from total authoritative XP.
 * Pure mathematical calculation matching PostgreSQL calculate_level_progress(p_xp)
 */
export function calculateLevelProgress(rawXp: number): LevelProgress {
  const totalXp = Math.max(0, Math.floor(rawXp || 0))

  // Quadratic solution for 25 * (L - 1) * (L + 2) <= XP:
  // L = floor((sqrt(9 + 0.16 * XP) - 1) / 2)
  const level = Math.max(
    1,
    Math.floor((Math.sqrt(9 + 0.16 * totalXp) - 1) / 2)
  )

  const currentLevelXp = 25 * (level - 1) * (level + 2)
  const nextLevelXp = 25 * level * (level + 3)
  const levelSpan = nextLevelXp - currentLevelXp

  const xpInLevel = Math.max(0, totalXp - currentLevelXp)
  const xpRequired = Math.max(0, nextLevelXp - totalXp)

  let progressPercentage = 0.0
  if (levelSpan > 0) {
    progressPercentage = Math.min(
      100.0,
      Math.max(0.0, Math.round((xpInLevel / levelSpan) * 1000) / 10)
    )
  }

  const title = getLevelTierTitle(level)

  return {
    level,
    title,
    totalXp,
    currentLevelXp,
    nextLevelXp,
    xpInLevel,
    xpRequired,
    progressPercentage,
  }
}
