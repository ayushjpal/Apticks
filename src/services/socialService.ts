import { supabase } from '../lib/supabase'

export interface SocialUserSummary {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  total_xp: number
  level: number
  level_title: string
  solved_count: number
  is_caller: boolean
  is_following: boolean
}

export interface PublicUserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  total_xp: number
  level: number
  level_title: string
  current_level_xp: number
  next_level_xp: number
  xp_in_level: number
  xp_required: number
  progress_percentage: number
  rank: number | null
  total_attempts: number
  correct_attempts: number
  wrong_attempts: number
  accuracy_percentage: number
  solved_count: number
  contests_count: number
  current_streak: number
  followers_count: number
  following_count: number
  friends_count: number
  is_caller: boolean
  is_following: boolean
  is_blocked_by_caller: boolean
  friendship_status: 'none' | 'friend' | 'incoming_pending' | 'outgoing_pending'
  friend_request_id: string | null
}

export interface PublicProfileResult {
  success: boolean
  found: boolean
  message?: string
  profile?: PublicUserProfile
}

export interface FollowerUserItem {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  level: number
  level_title: string
  total_xp: number
  solved_count: number
  followed_at: string
  is_following_back: boolean
  is_caller: boolean
}

export interface FollowingUserItem {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  level: number
  level_title: string
  total_xp: number
  solved_count: number
  followed_at: string
  is_following: boolean
  is_caller: boolean
}

export interface BlockedUserItem {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface FriendUserItem {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  level: number
  level_title: string
  total_xp: number
  solved_count: number
  friendship_id: string
  friends_since: string
  is_following: boolean
}

export interface IncomingFriendRequestItem {
  request_id: string
  created_at: string
  sender: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    level: number
    level_title: string
    total_xp: number
    solved_count: number
    is_following: boolean
  }
}

export interface OutgoingFriendRequestItem {
  request_id: string
  created_at: string
  recipient: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    level: number
    level_title: string
    total_xp: number
    solved_count: number
  }
}

export interface RelationshipStatusResult {
  success: boolean
  is_caller: boolean
  friend_status: 'none' | 'friend' | 'incoming_pending' | 'outgoing_pending' | 'blocked' | 'unavailable'
  friend_request_id: string | null
  is_following: boolean
  is_follower: boolean
  is_blocked: boolean
  message?: string
}

export class SocialService {
  /**
   * Search users across the arena by username or display name.
   * Server RPC guarantees case-insensitivity, mutual block filtering, and zero email exposure.
   */
  static async searchUsers(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ success: boolean; users: SocialUserSummary[]; message?: string }> {
    const trimmed = query.trim()
    if (!trimmed) {
      return { success: true, users: [] }
    }

    try {
      const { data, error } = await supabase.rpc('search_users', {
        p_query: trimmed,
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        console.error('SocialService.searchUsers RPC error:', error)
        return { success: false, users: [], message: error.message }
      }

      const res = data as { success: boolean; users?: SocialUserSummary[]; message?: string }
      return {
        success: res.success,
        users: res.users || [],
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.searchUsers unexpected error:', err)
      return {
        success: false,
        users: [],
        message: err instanceof Error ? err.message : 'Failed to search competitors',
      }
    }
  }

  /**
   * Get public competitor profile by canonical username.
   * Returns authoritative stats, ranks, unified XP, friend status, and block status.
   * If blocked mutually, returns found: false.
   */
  static async getPublicProfile(username: string): Promise<PublicProfileResult> {
    const cleanUsername = username.trim().toLowerCase()
    if (!cleanUsername) {
      return { success: false, found: false, message: 'Username is required' }
    }

    try {
      const { data, error } = await supabase.rpc('get_public_profile', {
        p_username: cleanUsername,
      })

      if (error) {
        console.error('SocialService.getPublicProfile RPC error:', error)
        return { success: false, found: false, message: error.message }
      }

      const res = data as PublicProfileResult
      return res
    } catch (err: unknown) {
      console.error('SocialService.getPublicProfile unexpected error:', err)
      return {
        success: false,
        found: false,
        message: err instanceof Error ? err.message : 'Failed to load public profile',
      }
    }
  }

  /**
   * Server-authoritative follow/unfollow toggle.
   */
  static async toggleFollowUser(
    targetUserId: string
  ): Promise<{ success: boolean; following: boolean; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('toggle_follow_user', {
        p_target_user_id: targetUserId,
      })

      if (error) {
        console.error('SocialService.toggleFollowUser RPC error:', error)
        return { success: false, following: false, message: error.message }
      }

      const res = data as { success: boolean; following: boolean; message?: string }
      return res
    } catch (err: unknown) {
      console.error('SocialService.toggleFollowUser unexpected error:', err)
      return {
        success: false,
        following: false,
        message: err instanceof Error ? err.message : 'Follow action failed',
      }
    }
  }

  /**
   * Fetch followers list for a user.
   */
  static async getUserFollowers(
    targetUserId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; followers: FollowerUserItem[]; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_user_followers', {
        p_target_user_id: targetUserId,
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        console.error('SocialService.getUserFollowers RPC error:', error)
        return { success: false, followers: [], message: error.message }
      }

      const res = data as { success: boolean; followers?: FollowerUserItem[]; message?: string }
      return {
        success: res.success,
        followers: res.followers || [],
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.getUserFollowers unexpected error:', err)
      return {
        success: false,
        followers: [],
        message: err instanceof Error ? err.message : 'Failed to load followers',
      }
    }
  }

  /**
   * Fetch following list for a user.
   */
  static async getUserFollowing(
    targetUserId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; following: FollowingUserItem[]; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_user_following', {
        p_target_user_id: targetUserId,
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        console.error('SocialService.getUserFollowing RPC error:', error)
        return { success: false, following: [], message: error.message }
      }

      const res = data as { success: boolean; following?: FollowingUserItem[]; message?: string }
      return {
        success: res.success,
        following: res.following || [],
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.getUserFollowing unexpected error:', err)
      return {
        success: false,
        following: [],
        message: err instanceof Error ? err.message : 'Failed to load following accounts',
      }
    }
  }

  /**
   * Server-authoritative user block.
   * Cleans up mutual follow relationships, friendships, and cancels pending 1v1s.
   */
  static async blockUser(
    targetUserId: string
  ): Promise<{ success: boolean; blocked: boolean; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('block_user', {
        p_target_user_id: targetUserId,
      })

      if (error) {
        console.error('SocialService.blockUser RPC error:', error)
        return { success: false, blocked: false, message: error.message }
      }

      const res = data as { success: boolean; blocked: boolean; message?: string }
      return res
    } catch (err: unknown) {
      console.error('SocialService.blockUser unexpected error:', err)
      return {
        success: false,
        blocked: false,
        message: err instanceof Error ? err.message : 'Block action failed',
      }
    }
  }

  /**
   * Server-authoritative user unblock.
   */
  static async unblockUser(
    targetUserId: string
  ): Promise<{ success: boolean; unblocked: boolean; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('unblock_user', {
        p_target_user_id: targetUserId,
      })

      if (error) {
        console.error('SocialService.unblockUser RPC error:', error)
        return { success: false, unblocked: false, message: error.message }
      }

      const res = data as { success: boolean; unblocked: boolean; message?: string }
      return res
    } catch (err: unknown) {
      console.error('SocialService.unblockUser unexpected error:', err)
      return {
        success: false,
        unblocked: false,
        message: err instanceof Error ? err.message : 'Unblock action failed',
      }
    }
  }

  /**
   * Fetch caller's blocked accounts list.
   */
  static async getMyBlockedUsers(): Promise<{
    success: boolean
    blocked: BlockedUserItem[]
    message?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('get_my_blocked_users')

      if (error) {
        console.error('SocialService.getMyBlockedUsers RPC error:', error)
        return { success: false, blocked: [], message: error.message }
      }

      const res = data as { success: boolean; blocked?: BlockedUserItem[]; message?: string }
      return {
        success: res.success,
        blocked: res.blocked || [],
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.getMyBlockedUsers unexpected error:', err)
      return {
        success: false,
        blocked: [],
        message: err instanceof Error ? err.message : 'Failed to load blocked users',
      }
    }
  }

  // ============================================================================
  // MODULE 10 PHASE 3: FRIENDS & FRIEND REQUEST METHODS
  // ============================================================================

  /**
   * Send a friend request to a competitor.
   */
  static async sendFriendRequest(
    targetUserId: string
  ): Promise<{ success: boolean; request_id?: string; status?: string; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        p_target_user_id: targetUserId,
      })

      if (error) {
        console.error('SocialService.sendFriendRequest RPC error:', error)
        return { success: false, message: error.message }
      }

      return data as { success: boolean; request_id?: string; status?: string; message?: string; error?: string }
    } catch (err: unknown) {
      console.error('SocialService.sendFriendRequest unexpected error:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send friend request',
      }
    }
  }

  /**
   * Accept or reject an incoming friend request.
   */
  static async respondToFriendRequest(
    requestId: string,
    action: 'accept' | 'reject'
  ): Promise<{ success: boolean; status?: string; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        p_request_id: requestId,
        p_action: action,
      })

      if (error) {
        console.error('SocialService.respondToFriendRequest RPC error:', error)
        return { success: false, message: error.message }
      }

      return data as { success: boolean; status?: string; message?: string; error?: string }
    } catch (err: unknown) {
      console.error('SocialService.respondToFriendRequest unexpected error:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : `Failed to ${action} friend request`,
      }
    }
  }

  /**
   * Cancel an outgoing pending friend request.
   */
  static async cancelFriendRequest(
    requestId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('cancel_friend_request', {
        p_request_id: requestId,
      })

      if (error) {
        console.error('SocialService.cancelFriendRequest RPC error:', error)
        return { success: false, message: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err: unknown) {
      console.error('SocialService.cancelFriendRequest unexpected error:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to cancel friend request',
      }
    }
  }

  /**
   * Remove an active friend. Follow relationships remain untouched.
   */
  static async removeFriend(
    targetUserId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('remove_friend', {
        p_target_user_id: targetUserId,
      })

      if (error) {
        console.error('SocialService.removeFriend RPC error:', error)
        return { success: false, message: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err: unknown) {
      console.error('SocialService.removeFriend unexpected error:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to remove friend',
      }
    }
  }

  /**
   * Fetch authenticated user's accepted friends list.
   */
  static async getMyFriends(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; friends: FriendUserItem[]; total_count: number; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_my_friends', {
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        console.error('SocialService.getMyFriends RPC error:', error)
        return { success: false, friends: [], total_count: 0, message: error.message }
      }

      const res = data as { success: boolean; friends?: FriendUserItem[]; total_count?: number; message?: string }
      return {
        success: res.success,
        friends: res.friends || [],
        total_count: res.total_count || 0,
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.getMyFriends unexpected error:', err)
      return {
        success: false,
        friends: [],
        total_count: 0,
        message: err instanceof Error ? err.message : 'Failed to load friends list',
      }
    }
  }

  /**
   * Fetch incoming pending friend requests.
   */
  static async getIncomingFriendRequests(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; requests: IncomingFriendRequestItem[]; total_count: number; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_incoming_friend_requests', {
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        console.error('SocialService.getIncomingFriendRequests RPC error:', error)
        return { success: false, requests: [], total_count: 0, message: error.message }
      }

      const res = data as { success: boolean; requests?: IncomingFriendRequestItem[]; total_count?: number; message?: string }
      return {
        success: res.success,
        requests: res.requests || [],
        total_count: res.total_count || 0,
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.getIncomingFriendRequests unexpected error:', err)
      return {
        success: false,
        requests: [],
        total_count: 0,
        message: err instanceof Error ? err.message : 'Failed to load incoming friend requests',
      }
    }
  }

  /**
   * Fetch outgoing pending friend requests.
   */
  static async getOutgoingFriendRequests(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; requests: OutgoingFriendRequestItem[]; total_count: number; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_outgoing_friend_requests', {
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        console.error('SocialService.getOutgoingFriendRequests RPC error:', error)
        return { success: false, requests: [], total_count: 0, message: error.message }
      }

      const res = data as { success: boolean; requests?: OutgoingFriendRequestItem[]; total_count?: number; message?: string }
      return {
        success: res.success,
        requests: res.requests || [],
        total_count: res.total_count || 0,
        message: res.message,
      }
    } catch (err: unknown) {
      console.error('SocialService.getOutgoingFriendRequests unexpected error:', err)
      return {
        success: false,
        requests: [],
        total_count: 0,
        message: err instanceof Error ? err.message : 'Failed to load outgoing friend requests',
      }
    }
  }

  /**
   * Fetch complete relationship status between caller and target.
   */
  static async getRelationshipStatus(
    targetUserId: string
  ): Promise<RelationshipStatusResult> {
    try {
      const { data, error } = await supabase.rpc('get_relationship_status', {
        p_target_user_id: targetUserId,
      })

      if (error) {
        console.error('SocialService.getRelationshipStatus RPC error:', error)
        return {
          success: false,
          is_caller: false,
          friend_status: 'none',
          friend_request_id: null,
          is_following: false,
          is_follower: false,
          is_blocked: false,
          message: error.message,
        }
      }

      return data as RelationshipStatusResult
    } catch (err: unknown) {
      console.error('SocialService.getRelationshipStatus unexpected error:', err)
      return {
        success: false,
        is_caller: false,
        friend_status: 'none',
        friend_request_id: null,
        is_following: false,
        is_follower: false,
        is_blocked: false,
        message: err instanceof Error ? err.message : 'Failed to determine relationship status',
      }
    }
  }
}
