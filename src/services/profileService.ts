import { supabase } from '../lib/supabase'
import { validateUsername, normalizeUsername } from '../utils/validation'
import type { AppRole } from '../types/roles'

export interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role?: AppRole
  username_changed_at: string | null
  created_at?: string
  updated_at?: string
}

export interface UsernameCooldownInfo {
  canChange: boolean
  daysLeft: number
  nextChangeDate: Date | null
  formattedNextChangeDate: string | null
}

export interface UsernameValidationResult {
  isValid: boolean
  isAvailable: boolean
  isCurrent: boolean
  message: string
}

export class ProfileService {
  /**
   * Check if user is eligible to change username (14 days cooldown rule)
   */
  static getUsernameCooldownInfo(usernameChangedAt: string | null | undefined): UsernameCooldownInfo {
    if (!usernameChangedAt) {
      return {
        canChange: true,
        daysLeft: 0,
        nextChangeDate: null,
        formattedNextChangeDate: null,
      }
    }

    const lastChangedTime = new Date(usernameChangedAt).getTime()
    if (isNaN(lastChangedTime)) {
      return {
        canChange: true,
        daysLeft: 0,
        nextChangeDate: null,
        formattedNextChangeDate: null,
      }
    }

    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
    const nextChangeTime = lastChangedTime + fourteenDaysMs
    const now = Date.now()

    if (now >= nextChangeTime) {
      return {
        canChange: true,
        daysLeft: 0,
        nextChangeDate: null,
        formattedNextChangeDate: null,
      }
    }

    const diffMs = nextChangeTime - now
    const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
    const nextDate = new Date(nextChangeTime)

    const formattedNextChangeDate = nextDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return {
      canChange: false,
      daysLeft,
      nextChangeDate: nextDate,
      formattedNextChangeDate,
    }
  }

  /**
   * Validate format and availability of a username
   */
  static async validateAndCheckUsername(
    rawUsername: string,
    currentUserId?: string | null,
    currentUsername?: string | null
  ): Promise<UsernameValidationResult> {
    const validation = validateUsername(rawUsername)

    if (!validation.isValid) {
      return {
        isValid: false,
        isAvailable: false,
        isCurrent: false,
        message: validation.message,
      }
    }

    const clean = validation.clean

    // 1. Check against provided currentUsername argument
    if (currentUsername && clean === normalizeUsername(currentUsername)) {
      return {
        isValid: true,
        isAvailable: false,
        isCurrent: true,
        message: 'This is your current username.',
      }
    }

    // 2. Query Supabase for username existence (Read-only check)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', clean)
        .maybeSingle()

      if (error) {
        console.warn('Supabase username check error:', error)
        return {
          isValid: true,
          isAvailable: true,
          isCurrent: false,
          message: `@${clean} format is valid.`,
        }
      }

      // If a profile exists in the database with this username
      if (data) {
        // If it belongs to the current user
        if (currentUserId && data.id === currentUserId) {
          return {
            isValid: true,
            isAvailable: false,
            isCurrent: true,
            message: 'This is your current username.',
          }
        }

        // If it belongs to someone else
        return {
          isValid: true,
          isAvailable: false,
          isCurrent: false,
          message: `@${clean} is already taken.`,
        }
      }

      // If no profile exists with this username
      return {
        isValid: true,
        isAvailable: true,
        isCurrent: false,
        message: `@${clean} is available!`,
      }
    } catch (err) {
      console.warn('Username check fallback:', err)
      return {
        isValid: true,
        isAvailable: true,
        isCurrent: false,
        message: `@${clean} format is valid.`,
      }
    }
  }

  /**
   * Fetch complete user profile directly from Supabase (single authoritative source of truth)
   */
  static async fetchProfile(userId: string): Promise<UserProfile | null> {
    try {
      // 1. Primary authoritative query: Fetch complete row from public.profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Primary Supabase profile query note, attempting fallback:', error)

        // Resilient fallback query if specific optional column constraints/schema issues exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', userId)
          .maybeSingle()

        if (!fallbackError && fallbackData) {
          return {
            id: fallbackData.id || userId,
            username: fallbackData.username || null,
            display_name: fallbackData.display_name || fallbackData.username || null,
            avatar_url: null,
            bio: null,
            role: 'user',
            username_changed_at: null,
            created_at: undefined,
            updated_at: undefined,
          }
        }
      }

      if (data) {
        const profile: UserProfile = {
          id: data.id || userId,
          username: data.username || null,
          display_name: data.display_name || data.username || null,
          avatar_url: data.avatar_url || null,
          bio: data.bio ?? null,
          role: (data.role as AppRole) || 'user',
          username_changed_at: data.username_changed_at ?? null,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }

        return profile
      }
    } catch (err) {
      console.error('Exception during profile fetch:', err)
    }

    return null
  }

  /**
   * Save / Update Profile in Supabase
   */
  static async updateProfile(
    userId: string,
    updates: {
      displayName?: string
      bio?: string
      avatarUrl?: string | null
      newUsername?: string
      currentUsername?: string | null
      currentUsernameChangedAt?: string | null
    }
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const isChangingUsername =
      updates.newUsername !== undefined &&
      normalizeUsername(updates.newUsername) !== normalizeUsername(updates.currentUsername || '')

    let newUsernameChangedAt = updates.currentUsernameChangedAt

    // Check 14-day rate limit if username is changing
    if (isChangingUsername && updates.newUsername) {
      const cooldown = this.getUsernameCooldownInfo(updates.currentUsernameChangedAt)
      if (!cooldown.canChange) {
        return {
          success: false,
          error: `Username can only be changed once every 14 days. You can change it again in ${cooldown.daysLeft} day(s) on ${cooldown.formattedNextChangeDate}.`,
        }
      }

      // Re-validate availability
      const validation = await this.validateAndCheckUsername(
        updates.newUsername,
        userId,
        updates.currentUsername
      )

      if (!validation.isValid) {
        return { success: false, error: validation.message }
      }

      if (!validation.isAvailable && !validation.isCurrent) {
        return { success: false, error: `Username @${normalizeUsername(updates.newUsername)} is already taken.` }
      }

      newUsernameChangedAt = new Date().toISOString()
    }

    const payload: Record<string, string | null> = {
      display_name: updates.displayName?.trim() || null,
      bio: updates.bio?.trim() || null,
      avatar_url: updates.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    }

    if (isChangingUsername && updates.newUsername) {
      payload.username = normalizeUsername(updates.newUsername)
      payload.username_changed_at = newUsernameChangedAt || null
    }

    // Update Supabase
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select('*')
        .maybeSingle()

      if (error) {
        console.error('Supabase profile update error:', error)
        if (error.code === '23505') {
          return { success: false, error: 'That username is already taken by another user.' }
        }

        // Try fallback update without optional columns if column doesn't exist yet
        try {
          const minimalPayload: Record<string, string | null> = {
            display_name: updates.displayName?.trim() || null,
            avatar_url: updates.avatarUrl ?? null,
            updated_at: new Date().toISOString(),
          }
          if (isChangingUsername && updates.newUsername) {
            minimalPayload.username = normalizeUsername(updates.newUsername)
          }
          const { data: fallbackData } = await supabase
            .from('profiles')
            .update(minimalPayload)
            .eq('id', userId)
            .select('*')
            .maybeSingle()

          const finalUsername = (isChangingUsername && updates.newUsername)
            ? normalizeUsername(updates.newUsername)
            : (fallbackData?.username || updates.currentUsername || null)

          // Sync auth user metadata
          try {
            await supabase.auth.updateUser({
              data: {
                username: finalUsername,
                display_name: updates.displayName?.trim() || finalUsername,
              },
            })
          } catch (syncErr) {
            console.warn('Syncing user_metadata failed:', syncErr)
          }

          const updatedProfile: UserProfile = {
            id: userId,
            username: finalUsername,
            display_name: fallbackData?.display_name || updates.displayName?.trim() || null,
            avatar_url: fallbackData?.avatar_url ?? updates.avatarUrl ?? null,
            bio: updates.bio?.trim() || null,
            username_changed_at: newUsernameChangedAt || null,
            updated_at: minimalPayload.updated_at || undefined,
            created_at: fallbackData?.created_at,
          }

          return {
            success: true,
            profile: updatedProfile,
          }
        } catch (fallbackErr) {
          console.warn('Fallback update failed', fallbackErr)
        }
      }

      const finalUsername = (isChangingUsername && updates.newUsername)
        ? normalizeUsername(updates.newUsername)
        : (data?.username || updates.currentUsername || null)

      // Sync auth user metadata
      try {
        await supabase.auth.updateUser({
          data: {
            username: finalUsername,
            display_name: updates.displayName?.trim() || finalUsername,
          },
        })
      } catch (syncErr) {
        console.warn('Syncing user_metadata failed:', syncErr)
      }

      const updatedProfile: UserProfile = {
        id: userId,
        username: finalUsername,
        display_name: data?.display_name || updates.displayName?.trim() || null,
        avatar_url: data?.avatar_url ?? updates.avatarUrl ?? null,
        bio: data?.bio ?? updates.bio?.trim() ?? null,
        username_changed_at: data?.username_changed_at ?? newUsernameChangedAt ?? null,
        updated_at: data?.updated_at || payload.updated_at || undefined,
        created_at: data?.created_at,
      }

      return {
        success: true,
        profile: updatedProfile,
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred while saving profile.'
      console.error('Exception updating profile:', err)
      return {
        success: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Upload image file as avatar (Supabase Storage or Base64 fallback)
   */
  static async uploadAvatar(userId: string, file: File): Promise<{ url: string | null; error?: string }> {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: 'Image size must be under 5MB.' }
    }

    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (!uploadError && uploadData) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
        if (data?.publicUrl) {
          return { url: data.publicUrl }
        }
      }
    } catch (e) {
      console.warn('Storage bucket upload failed, using high-quality compressed Base64 fallback', e)
    }

    // Fallback: Read as base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({ url: reader.result as string })
      }
      reader.onerror = () => {
        resolve({ url: null, error: 'Failed to process image file.' })
      }
      reader.readAsDataURL(file)
    })
  }

  /**
   * Set a user's role (Admin-only RPC)
   */
  static async adminSetUserRole(
    targetUserId: string,
    newRole: AppRole
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('admin_set_user_role', {
        p_target_user_id: targetUserId,
        p_new_role: newRole,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return (data as { success: boolean; error?: string; message?: string }) || { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update user role.'
      return { success: false, error: message }
    }
  }
}
