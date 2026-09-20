import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ProfileService, type UserProfile } from '../services/profileService'
import { StreakService } from '../services/streakService'
import { LeaderboardService } from '../services/leaderboardService'
import { calculateLevelProgress, type LevelProgress } from '../utils/levelEngine'
import type { UserStreak } from '../types/questions'

export interface UserSessionContextValue {
  user: User | null
  profile: UserProfile | null
  streak: UserStreak | null
  rank: number | null
  level: number
  levelTitle: string
  totalXp: number
  levelProgress: LevelProgress | null
  loading: boolean
  error: string | null
  refreshUserMetrics: () => Promise<void>
}

const UserSessionContext = createContext<UserSessionContextValue | null>(null)

export const UserSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [streak, setStreak] = useState<UserStreak | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [level, setLevel] = useState<number>(1)
  const [levelTitle, setLevelTitle] = useState<string>('Novice')
  const [totalXp, setTotalXp] = useState<number>(0)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Deduplication refs & generation tracking to prevent stale response overwrites
  const lastFetchedUserIdRef = useRef<string | null>(null)
  const fetchGenerationRef = useRef<number>(0)
  const inFlightFetchRef = useRef<{
    promise: Promise<void>
    generation: number
    isForced: boolean
  } | null>(null)
  const currentUserRef = useRef<User | null>(null)
  const isMountedRef = useRef<boolean>(true)

  const fetchMetricsForUser = useCallback(async (targetUser: User, force: boolean = false): Promise<void> => {
    // If we already fetched for this user and not forcing a refresh, skip
    if (!force && lastFetchedUserIdRef.current === targetUser.id) {
      if (inFlightFetchRef.current) {
        return inFlightFetchRef.current.promise
      }
      return
    }

    // Check in-flight request deduplication
    const inFlight = inFlightFetchRef.current
    if (inFlight) {
      if (force) {
        // If an in-flight request is ALREADY forced and matches the current generation, reuse it!
        if (inFlight.isForced && inFlight.generation === fetchGenerationRef.current) {
          return inFlight.promise
        }
        // Otherwise an unforced or older fetch is in-flight: bypass it with a new generation below
      } else {
        // Unforced call can reuse any running fetch
        return inFlight.promise
      }
    }

    // Assign a new generation token for this request
    const requestGen = ++fetchGenerationRef.current
    lastFetchedUserIdRef.current = targetUser.id

    const promise = (async () => {
      try {
        let userProfile = await ProfileService.fetchProfile(targetUser.id)
        const metaUsername = typeof targetUser.user_metadata?.username === 'string' ? targetUser.user_metadata.username : null
        const metaDisplayName = typeof targetUser.user_metadata?.display_name === 'string'
          ? targetUser.user_metadata.display_name
          : metaUsername

        if (!userProfile?.username && metaUsername) {
          userProfile = {
            id: targetUser.id,
            username: metaUsername,
            display_name: metaDisplayName,
            avatar_url: userProfile?.avatar_url || null,
            bio: userProfile?.bio || null,
            username_changed_at: userProfile?.username_changed_at || null,
          }
        }

        const [userStreak, rankRes] = await Promise.all([
          StreakService.getUserStreak(targetUser.id, force),
          LeaderboardService.getUserGlobalRank(targetUser.id, force),
        ])

        if (!isMountedRef.current) return

        // STALE RESPONSE PROTECTION:
        // If a newer fetch generation was launched while this request was running,
        // DISCARD this older response to prevent stale metrics from overwriting newer forced state!
        if (requestGen < fetchGenerationRef.current) {
          return
        }

        currentUserRef.current = targetUser
        setUser(targetUser)
        setProfile(userProfile)
        setStreak(userStreak)

        if (rankRes.found && typeof rankRes.totalXp === 'number') {
          setTotalXp(rankRes.totalXp)
          setRank(typeof rankRes.rank === 'number' ? rankRes.rank : null)
          setLevel(rankRes.level ?? 1)
          setLevelTitle(rankRes.levelTitle ?? 'Novice')
          if (rankRes.levelProgress) {
            setLevelProgress(rankRes.levelProgress)
          } else {
            setLevelProgress(calculateLevelProgress(rankRes.totalXp))
          }
        } else {
          setTotalXp(0)
          setRank(null)
          setLevel(1)
          setLevelTitle('Novice')
          setLevelProgress(calculateLevelProgress(0))
        }

        setError(null)
      } catch (err) {
        console.warn('UserSessionContext fetch error:', err)
        if (isMountedRef.current && requestGen >= fetchGenerationRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load user metrics')
        }
      } finally {
        if (inFlightFetchRef.current?.generation === requestGen) {
          inFlightFetchRef.current = null
        }
        if (isMountedRef.current && requestGen >= fetchGenerationRef.current) {
          setLoading(false)
        }
      }
    })()

    inFlightFetchRef.current = {
      promise,
      generation: requestGen,
      isForced: force,
    }
    return promise
  }, [])

  // Public refresh function to re-fetch when XP/profile updates occur
  const refreshUserMetrics = useCallback(async (): Promise<void> => {
    let currentUser = currentUserRef.current ?? user
    if (!currentUser) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      currentUser = authUser
    }
    if (currentUser) {
      StreakService.invalidateStreakCache(currentUser.id)
      LeaderboardService.invalidateUserRank(currentUser.id)
      await fetchMetricsForUser(currentUser, true)
    }
  }, [user, fetchMetricsForUser])

  useEffect(() => {
    isMountedRef.current = true

    // Set up single auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMountedRef.current) return

      if (session?.user) {
        currentUserRef.current = session.user
        fetchMetricsForUser(session.user, false)
      } else if (event === 'SIGNED_OUT' || !session) {
        lastFetchedUserIdRef.current = null
        currentUserRef.current = null
        fetchGenerationRef.current++
        inFlightFetchRef.current = null
        setUser(null)
        setProfile(null)
        setStreak(null)
        setRank(null)
        setLevel(1)
        setLevelTitle('Novice')
        setTotalXp(0)
        setLevelProgress(null)
        setLoading(false)
      }
    })

    // Fallback: check initial session once in case onAuthStateChange is delayed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMountedRef.current) return
      if (session?.user && lastFetchedUserIdRef.current !== session.user.id) {
        currentUserRef.current = session.user
        fetchMetricsForUser(session.user, false)
      } else if (!session) {
        setLoading(false)
      }
    })

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [fetchMetricsForUser])

  const value: UserSessionContextValue = {
    user,
    profile,
    streak,
    rank,
    level,
    levelTitle,
    totalXp,
    levelProgress,
    loading,
    error,
    refreshUserMetrics,
  }

  return (
    <UserSessionContext.Provider value={value}>
      {children}
    </UserSessionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserSession(): UserSessionContextValue {
  const context = useContext(UserSessionContext)
  if (!context) {
    throw new Error('useUserSession must be used within a UserSessionProvider')
  }
  return context
}
