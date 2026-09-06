import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ProfileService } from '../services/profileService'
import type { AppRole, RolePermissions } from '../types/roles'
import {
  ROLE_PERMISSIONS,
  isStaffRole,
  isAdminRole,
} from '../types/roles'

export interface UseRoleReturn {
  role: AppRole
  isAdmin: boolean
  isModerator: boolean
  isStaff: boolean
  permissions: RolePermissions
  loading: boolean
  userId: string | null
  refetchRole: () => Promise<void>
}

export function useRole(): UseRoleReturn {
  const [role, setRole] = useState<AppRole>('user')
  const [loading, setLoading] = useState<boolean>(true)
  const [userId, setUserId] = useState<string | null>(null)

  const loadUserRole = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user?.id) {
        setRole('user')
        setUserId(null)
        setLoading(false)
        return
      }

      setUserId(session.user.id)

      // Query database-authoritative role from profiles
      const profile = await ProfileService.fetchProfile(session.user.id)
      if (profile?.role) {
        setRole(profile.role)
      } else {
        setRole('user')
      }
    } catch (err) {
      console.error('Error loading user role:', err)
      setRole('user')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initRole = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        if (!session?.user?.id) {
          setRole('user')
          setUserId(null)
          setLoading(false)
          return
        }

        setUserId(session.user.id)
        const profile = await ProfileService.fetchProfile(session.user.id)
        if (!isMounted) return

        if (profile?.role) {
          setRole(profile.role)
        } else {
          setRole('user')
        }
      } catch (err) {
        console.error('Error in initRole:', err)
        if (isMounted) setRole('user')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      if (session?.user?.id) {
        loadUserRole(false)
      } else {
        setRole('user')
        setUserId(null)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadUserRole])

  return {
    role,
    isAdmin: isAdminRole(role),
    isModerator: role === 'moderator',
    isStaff: isStaffRole(role),
    permissions: ROLE_PERMISSIONS[role],
    loading,
    userId,
    refetchRole: loadUserRole,
  }
}
