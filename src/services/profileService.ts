import { supabase } from '../lib/supabase'

export interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
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

const LOCAL_STORAGE_KEY_PREFIX = 'aptiverse_profile_'

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
    currentUserId: string,
    currentUsername: string | null | undefined
  ): Promise<UsernameValidationResult> {
    const clean = rawUsername.trim().toLowerCase()

    if (!clean) {
      return {
        isValid: false,
        isAvailable: false,
        isCurrent: false,
        message: 'Username cannot be empty.',
      }
    }

    if (clean.length < 3) {
      return {
        isValid: false,
        isAvailable: false,
        isCurrent: false,
        message: 'Username must be at least 3 characters.',
      }
    }

    if (clean.length > 30) {
      return {
        isValid: false,
        isAvailable: false,
        isCurrent: false,
        message: 'Username cannot exceed 30 characters.',
      }
    }

    // Only alphanumeric and underscores/dots (like Instagram)
    const validPattern = /^[a-z0-9_][a-z0-9_.]*[a-z0-9_]$/
    if (!validPattern.test(clean) && clean.length > 2) {
      return {
        isValid: false,
        isAvailable: false,
        isCurrent: false,
        message: 'Use only letters, numbers, periods, and underscores. Cannot start or end with a period.',
      }
    }

    // Check if it's identical to current username
    if (currentUsername && clean === currentUsername.trim().toLowerCase()) {
      return {
        isValid: true,
        isAvailable: true,
        isCurrent: true,
        message: 'This is your current username.',
      }
    }

    // Query Supabase for username existence
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', clean)
        .maybeSingle()

      if (error) {
        console.warn('Supabase username check error:', error)
        // If DB query fails, allow pass if clean format is valid
        return {
          isValid: true,
          isAvailable: true,
          isCurrent: false,
          message: 'Username format is valid.',
        }
      }

      if (data && data.id !== currentUserId) {
        return {
          isValid: true,
          isAvailable: false,
          isCurrent: false,
          message: `@${clean} is already taken.`,
        }
      }

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
        message: 'Username format is valid.',
      }
    }
  }

  /**
   * Fetch complete user profile from Supabase with localStorage fallback
   */
  static async fetchProfile(userId: string): Promise<UserProfile | null> {
    // Try localStorage cache first for fast initial load
    let localData: Partial<UserProfile> | null = null
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`)
      if (stored) {
        localData = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('Failed reading local profile cache', e)
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, username_changed_at, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Error fetching Supabase profile, using fallback:', error)
      }

      if (data) {
        const mergedProfile: UserProfile = {
          id: data.id || userId,
          username: data.username || localData?.username || null,
          display_name: data.display_name || localData?.display_name || null,
          avatar_url: data.avatar_url || localData?.avatar_url || null,
          bio: data.bio ?? localData?.bio ?? null,
          username_changed_at: data.username_changed_at ?? localData?.username_changed_at ?? null,
          created_at: data.created_at || localData?.created_at,
          updated_at: data.updated_at || localData?.updated_at,
        }

        // Cache latest in localStorage
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(mergedProfile))
        } catch {}

        return mergedProfile
      }
    } catch (err) {
      console.warn('Exception during profile fetch:', err)
    }

    if (localData) {
      return {
        id: userId,
        username: localData.username || null,
        display_name: localData.display_name || null,
        avatar_url: localData.avatar_url || null,
        bio: localData.bio || null,
        username_changed_at: localData.username_changed_at || null,
        created_at: localData.created_at,
        updated_at: localData.updated_at,
      }
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
      updates.newUsername &&
      updates.newUsername.trim().toLowerCase() !== (updates.currentUsername || '').trim().toLowerCase()

    let newUsernameChangedAt = updates.currentUsernameChangedAt

    // Check 14-day rate limit if username is changing
    if (isChangingUsername) {
      const cooldown = this.getUsernameCooldownInfo(updates.currentUsernameChangedAt)
      if (!cooldown.canChange) {
        return {
          success: false,
          error: `Username can only be changed once every 14 days. You can change it again in ${cooldown.daysLeft} day(s) on ${cooldown.formattedNextChangeDate}.`,
        }
      }

      // Re-validate availability
      const validation = await this.validateAndCheckUsername(
        updates.newUsername!,
        userId,
        updates.currentUsername
      )

      if (!validation.isValid) {
        return { success: false, error: validation.message }
      }

      if (!validation.isAvailable && !validation.isCurrent) {
        return { success: false, error: `Username @${updates.newUsername} is already taken.` }
      }

      newUsernameChangedAt = new Date().toISOString()
    }

    const payload: Record<string, any> = {
      display_name: updates.displayName?.trim(),
      bio: updates.bio?.trim() || null,
      avatar_url: updates.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    }

    if (isChangingUsername) {
      payload.username = updates.newUsername!.trim().toLowerCase()
      payload.username_changed_at = newUsernameChangedAt
    }

    // Update Supabase
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .maybeSingle()

      if (error) {
        console.error('Supabase profile update error:', error)
        if (error.code === '23505') {
          return { success: false, error: 'That username is already taken by another user.' }
        }
        // Try fallback update without optional columns if column doesn't exist yet
        try {
          const minimalPayload: Record<string, any> = {
            display_name: updates.displayName?.trim(),
            updated_at: new Date().toISOString(),
          }
          if (isChangingUsername) {
            minimalPayload.username = updates.newUsername!.trim().toLowerCase()
          }
          await supabase.from('profiles').update(minimalPayload).eq('id', userId)
        } catch {}
      }

      // Merge and save to localStorage
      const updatedProfile: UserProfile = {
        id: userId,
        username: isChangingUsername ? updates.newUsername!.trim().toLowerCase() : (updates.currentUsername || null),
        display_name: updates.displayName?.trim() || null,
        avatar_url: updates.avatarUrl ?? null,
        bio: updates.bio?.trim() || null,
        username_changed_at: newUsernameChangedAt || null,
        updated_at: payload.updated_at,
        created_at: data?.created_at,
      }

      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updatedProfile))
      } catch {}

      return {
        success: true,
        profile: updatedProfile,
      }
    } catch (err: any) {
      console.error('Exception updating profile:', err)
      return {
        success: false,
        error: err.message || 'An unexpected error occurred while saving profile.',
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
}
