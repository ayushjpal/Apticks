import { supabase } from '../lib/supabase'
import type { AppRole } from '../types/roles'

export interface AdminUserRecord {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: AppRole
  created_at: string | null
  updated_at: string | null
}

export interface AdminRoleCounts {
  all: number
  admin: number
  moderator: number
  user: number
}

export interface AdminSetRoleResult {
  success: boolean
  error?: string
  message?: string
  new_role?: AppRole
  user_id?: string
}

export class AdminUserService {
  /**
   * Fetch all registered users from public.profiles with optional search and role filtering.
   * Only non-sensitive profile columns are requested.
   */
  static async fetchUsers(options?: {
    search?: string
    roleFilter?: AppRole | 'all'
  }): Promise<{ users: AdminUserRecord[]; error: string | null }> {
    try {
      let query = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, role, created_at, updated_at')
        .order('created_at', { ascending: false })

      // Server-side role filter if specified
      if (options?.roleFilter && options.roleFilter !== 'all') {
        query = query.eq('role', options.roleFilter)
      }

      // Server-side search filter on username or display_name
      if (options?.search && options.search.trim()) {
        const cleanSearch = options.search.trim()
        query = query.or(`username.ilike.%${cleanSearch}%,display_name.ilike.%${cleanSearch}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching admin users:', error)
        return { users: [], error: error.message }
      }

      const users: AdminUserRecord[] = (data || []).map((row) => ({
        id: row.id,
        username: row.username,
        display_name: row.display_name || row.username,
        avatar_url: row.avatar_url,
        bio: row.bio,
        role: (row.role as AppRole) || 'user',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }))

      return { users, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      console.error('AdminUserService.fetchUsers exception:', err)
      return { users: [], error: message }
    }
  }

  /**
   * Compute live, real-time role distribution counts directly from public.profiles.
   */
  static async fetchRoleCounts(): Promise<AdminRoleCounts> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')

      if (error || !data) {
        console.error('Error fetching role counts:', error)
        return { all: 0, admin: 0, moderator: 0, user: 0 }
      }

      const counts: AdminRoleCounts = {
        all: data.length,
        admin: 0,
        moderator: 0,
        user: 0,
      }

      for (const row of data) {
        const r = row.role as AppRole
        if (r === 'admin') counts.admin++
        else if (r === 'moderator') counts.moderator++
        else counts.user++
      }

      return counts
    } catch (err) {
      console.error('AdminUserService.fetchRoleCounts exception:', err)
      return { all: 0, admin: 0, moderator: 0, user: 0 }
    }
  }

  /**
   * Safely update a user's role using the server-authoritative admin_set_user_role RPC.
   * Direct table mutations on profiles.role are blocked by database trigger.
   */
  static async changeUserRole(
    targetUserId: string,
    newRole: AppRole
  ): Promise<AdminSetRoleResult> {
    try {
      const { data, error } = await supabase.rpc('admin_set_user_role', {
        p_target_user_id: targetUserId,
        p_new_role: newRole,
      })

      if (error) {
        return {
          success: false,
          error: error.code || 'RPC_ERROR',
          message: error.message || 'Database rejected the role change.',
        }
      }

      // Parse JSONB result from RPC
      const result = data as AdminSetRoleResult
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'OPERATION_FAILED',
          message: result.message || 'Failed to update user role.',
        }
      }

      return {
        success: true,
        message: result.message || 'User role updated successfully.',
        new_role: result.new_role,
        user_id: result.user_id,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error updating role'
      return {
        success: false,
        error: 'CLIENT_EXCEPTION',
        message,
      }
    }
  }
}
