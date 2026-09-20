import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Users,
  Search,
  ShieldAlert,
  Ban,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
  Clock,
  Inbox,
  Send,
} from 'lucide-react'
import {
  SocialService,
  type SocialUserSummary,
  type BlockedUserItem,
  type FriendUserItem,
  type IncomingFriendRequestItem,
  type OutgoingFriendRequestItem,
} from '../../services/socialService'
import { UserSocialCard } from './components/UserSocialCard'

type SocialTab = 'find' | 'friends' | 'requests' | 'blocked'
type RequestsSubTab = 'incoming' | 'outgoing'

const VALID_TABS: readonly SocialTab[] = ['find', 'friends', 'requests', 'blocked'] as const

export default function SocialHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') as SocialTab | null
  const activeTab: SocialTab = rawTab && (VALID_TABS as readonly string[]).includes(rawTab) ? rawTab : 'find'
  const [requestsSubTab, setRequestsSubTab] = useState<RequestsSubTab>('incoming')

  // Search State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [searchResults, setSearchResults] = useState<SocialUserSummary[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const searchRequestId = useRef(0)

  // Tab Loaded State (Retains state when switching between tabs: Friends -> Requests -> Friends)
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const [requestsLoaded, setRequestsLoaded] = useState(false)
  const [blockedLoaded, setBlockedLoaded] = useState(false)

  // Friends State
  const [friendsList, setFriendsList] = useState<FriendUserItem[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)

  // Friend Requests State
  const [incomingRequests, setIncomingRequests] = useState<IncomingFriendRequestItem[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingFriendRequestItem[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  // Blocked State
  const [blockedList, setBlockedList] = useState<BlockedUserItem[]>([])
  const [blockedLoading, setBlockedLoading] = useState(false)

  // Global Notification / Toast
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Block Confirmation Modal State
  const [blockModal, setBlockModal] = useState<{
    isOpen: boolean
    targetId: string
    username: string
    loading: boolean
  }>({
    isOpen: false,
    targetId: '',
    username: '',
    loading: false,
  })

  // Remove Friend Confirmation Modal State
  const [removeFriendModal, setRemoveFriendModal] = useState<{
    isOpen: boolean
    targetId: string
    username: string
    loading: boolean
  }>({
    isOpen: false,
    targetId: '',
    username: '',
    loading: false,
  })

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleTabChange = (newTab: SocialTab) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', newTab)
    setSearchParams(newParams, { replace: true })
  }

  // ----------------------------------------------------
  // 1. Debounced Search Logic
  // ----------------------------------------------------
  const executeSearch = useCallback(async (queryText: string) => {
    const clean = queryText.trim()
    if (clean.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      setHasSearched(false)
      setSearchError(null)
      return
    }

    const currentReq = ++searchRequestId.current
    setSearchLoading(true)
    setSearchError(null)

    const res = await SocialService.searchUsers(clean)

    // Sequence check: ignore stale responses if another search was triggered
    if (currentReq !== searchRequestId.current) return

    setSearchLoading(false)
    setHasSearched(true)

    if (res.success) {
      setSearchResults(res.users)
    } else {
      setSearchError(res.message || 'Failed to search competitors.')
      setSearchResults([])
    }
  }, [])

  // 300ms Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      executeSearch(searchQuery)
    }, 300)

    return () => clearTimeout(handler)
  }, [searchQuery, executeSearch])

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    const newParams = new URLSearchParams(searchParams)
    if (val) {
      newParams.set('q', val)
    } else {
      newParams.delete('q')
    }
    setSearchParams(newParams, { replace: true })
  }

  // ----------------------------------------------------
  // 2. Data Loaders with Phase 2 Tab State Retention
  // ----------------------------------------------------
  const loadFriends = useCallback(async (force = false) => {
    setFriendsLoading(!friendsLoaded || force)
    const res = await SocialService.getMyFriends(50, 0, force)
    setFriendsLoading(false)
    setFriendsLoaded(true)
    if (res.success) {
      setFriendsList(res.friends)
    }
  }, [friendsLoaded])

  const loadRequests = useCallback(async () => {
    setRequestsLoading(!requestsLoaded)
    const [inc, out] = await Promise.all([
      SocialService.getIncomingFriendRequests(),
      SocialService.getOutgoingFriendRequests(),
    ])
    setRequestsLoading(false)
    setRequestsLoaded(true)
    if (inc.success) setIncomingRequests(inc.requests)
    if (out.success) setOutgoingRequests(out.requests)
  }, [requestsLoaded])

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(!blockedLoaded)
    const res = await SocialService.getMyBlockedUsers()
    setBlockedLoading(false)
    setBlockedLoaded(true)
    if (res.success) setBlockedList(res.blocked)
  }, [blockedLoaded])

  // Auto load when tab activates ONLY IF NOT ALREADY LOADED
  useEffect(() => {
    let isMounted = true

    const fetchTabData = async () => {
      if (activeTab === 'friends' && !friendsLoaded) {
        setFriendsLoading(true)
        const res = await SocialService.getMyFriends()
        if (!isMounted) return
        setFriendsLoading(false)
        setFriendsLoaded(true)
        if (res.success) setFriendsList(res.friends)
      } else if (activeTab === 'requests' && !requestsLoaded) {
        setRequestsLoading(true)
        const [inc, out] = await Promise.all([
          SocialService.getIncomingFriendRequests(),
          SocialService.getOutgoingFriendRequests(),
        ])
        if (!isMounted) return
        setRequestsLoading(false)
        setRequestsLoaded(true)
        if (inc.success) setIncomingRequests(inc.requests)
        if (out.success) setOutgoingRequests(out.requests)
      } else if (activeTab === 'blocked' && !blockedLoaded) {
        setBlockedLoading(true)
        const res = await SocialService.getMyBlockedUsers()
        if (!isMounted) return
        setBlockedLoading(false)
        setBlockedLoaded(true)
        if (res.success) setBlockedList(res.blocked)
      }
    }

    fetchTabData()

    return () => {
      isMounted = false
    }
  }, [
    activeTab,
    friendsLoaded,
    requestsLoaded,
    blockedLoaded,
  ])

  // ----------------------------------------------------
  // 3. Friend Mutations
  // ----------------------------------------------------
  const handleSendFriendRequest = async (targetUserId: string) => {
    const res = await SocialService.sendFriendRequest(targetUserId)
    if (res.success) {
      showToast('Friend request sent!')
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === targetUserId
            ? {
                ...u,
                friendship_status: 'outgoing_pending',
                friend_request_id: res.request_id || null,
              }
            : u
        )
      )
      loadRequests()
    } else {
      showToast(res.message || 'Failed to send friend request.', 'error')
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    const res = await SocialService.respondToFriendRequest(requestId, 'accept')
    if (res.success) {
      showToast('Friend request accepted!')
      setIncomingRequests((prev) => prev.filter((r) => r.request_id !== requestId))
      loadFriends(true)
    } else {
      showToast(res.message || 'Failed to accept request.', 'error')
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    const res = await SocialService.respondToFriendRequest(requestId, 'reject')
    if (res.success) {
      showToast('Friend request declined.')
      setIncomingRequests((prev) => prev.filter((r) => r.request_id !== requestId))
    } else {
      showToast(res.message || 'Failed to decline request.', 'error')
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    const res = await SocialService.cancelFriendRequest(requestId)
    if (res.success) {
      showToast('Friend request cancelled.')
      setOutgoingRequests((prev) => prev.filter((r) => r.request_id !== requestId))
      setSearchResults((prev) =>
        prev.map((u) =>
          u.friend_request_id === requestId
            ? { ...u, friendship_status: 'none', friend_request_id: null }
            : u
        )
      )
    } else {
      showToast(res.message || 'Failed to cancel request.', 'error')
    }
  }

  const openRemoveFriendModal = (targetId: string, username: string) => {
    setRemoveFriendModal({
      isOpen: true,
      targetId,
      username,
      loading: false,
    })
  }

  const confirmRemoveFriend = async () => {
    if (!removeFriendModal.targetId) return
    setRemoveFriendModal((prev) => ({ ...prev, loading: true }))

    const res = await SocialService.removeFriend(removeFriendModal.targetId)
    setRemoveFriendModal({ isOpen: false, targetId: '', username: '', loading: false })

    if (res.success) {
      showToast(`Removed @${removeFriendModal.username} from friends.`)
      setFriendsList((prev) => prev.filter((f) => f.id !== removeFriendModal.targetId))
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === removeFriendModal.targetId
            ? { ...u, friendship_status: 'none', friend_request_id: null }
            : u
        )
      )
    } else {
      showToast(res.message || 'Failed to remove friend.', 'error')
    }
  }

  // ----------------------------------------------------
  // 4. Block Mutations
  // ----------------------------------------------------
  const openBlockModal = (targetId: string, username: string) => {
    setBlockModal({
      isOpen: true,
      targetId,
      username,
      loading: false,
    })
  }

  const confirmBlock = async () => {
    if (!blockModal.targetId) return
    setBlockModal((prev) => ({ ...prev, loading: true }))

    const res = await SocialService.blockUser(blockModal.targetId)
    setBlockModal({ isOpen: false, targetId: '', username: '', loading: false })

    if (res.success) {
      showToast(`@${blockModal.username} has been blocked.`)
      setSearchResults((prev) => prev.filter((u) => u.id !== blockModal.targetId))
      setFriendsList((prev) => prev.filter((f) => f.id !== blockModal.targetId))
      setIncomingRequests((prev) => prev.filter((r) => r.sender.id !== blockModal.targetId))
      setOutgoingRequests((prev) => prev.filter((r) => r.recipient.id !== blockModal.targetId))
      loadBlocked()
    } else {
      showToast(res.message || 'Failed to block user.', 'error')
    }
  }

  const handleUnblock = async (targetId: string) => {
    const res = await SocialService.unblockUser(targetId)
    if (res.success) {
      showToast('Competitor unblocked.')
      setBlockedList((prev) => prev.filter((u) => u.id !== targetId))
    } else {
      showToast(res.message || 'Failed to unblock competitor.', 'error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-entry pb-12">
      {/* Header Banner */}
      <div className="bg-[#091522] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold tracking-widest uppercase">
            <Users className="w-4 h-4" />
            <span>MODULE 10 • COMPETITIVE NETWORK</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight mt-1">
            SOCIAL HUB
          </h1>
          <p className="font-body text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Discover competitors, manage your accepted friends, coordinate 1v1 challenges, and build your arena network.
          </p>
        </div>

        {/* Quick Metrics */}
        <div className="flex items-center gap-3 self-start sm:self-center font-mono text-xs">
          <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
            <span className="text-slate-400 text-[10px] uppercase block">Friends</span>
            <span className="font-bold text-sm text-[#ffd43b]">{friendsList.length}</span>
          </div>
          <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
            <span className="text-slate-400 text-[10px] uppercase block">Requests</span>
            <span className="font-bold text-sm text-white">{incomingRequests.length}</span>
          </div>
          <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
            <span className="text-slate-400 text-[10px] uppercase block">Blocked</span>
            <span className="font-bold text-sm text-white">{blockedList.length}</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border font-mono text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Navigation Tab Bar: EXACTLY 4 TABS */}
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto select-none">
        {/* 1. FIND */}
        <button
          type="button"
          onClick={() => handleTabChange('find')}
          className={`px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'find'
              ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-[2px_2px_0_#0c1d2d]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Find</span>
        </button>

        {/* 2. FRIENDS */}
        <button
          type="button"
          onClick={() => handleTabChange('friends')}
          className={`px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'friends'
              ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-[2px_2px_0_#0c1d2d]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          <span>Friends</span>
          {friendsList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
              {friendsList.length}
            </span>
          )}
        </button>

        {/* 3. FRIEND REQUESTS */}
        <button
          type="button"
          onClick={() => handleTabChange('requests')}
          className={`px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'requests'
              ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-[2px_2px_0_#0c1d2d]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Requests</span>
          {incomingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-bold text-[10px] font-mono">
              {incomingRequests.length}
            </span>
          )}
        </button>

        {/* 4. BLOCKED */}
        <button
          type="button"
          onClick={() => handleTabChange('blocked')}
          className={`px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'blocked'
              ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-[2px_2px_0_#0c1d2d]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>Blocked</span>
          {blockedList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
              {blockedList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: FIND COMPETITORS */}
      {activeTab === 'find' && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by username or display name..."
              className="w-full pl-10 pr-10 py-3 bg-[#091522] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-[#ffd43b] focus:ring-1 focus:ring-[#ffd43b] transition-all font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                  setHasSearched(false)
                  const newParams = new URLSearchParams(searchParams)
                  newParams.delete('q')
                  setSearchParams(newParams, { replace: true })
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchQuery.trim().length === 1 && (
            <div className="p-4 bg-[#091522] border border-amber-400/20 rounded-xl text-center">
              <p className="font-mono text-xs text-amber-300">
                Type at least 2 characters to search competitors
              </p>
            </div>
          )}

          {searchLoading && (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-[#ffd43b] mx-auto mb-2" />
              <p className="font-mono text-xs text-slate-400">Searching the arena...</p>
            </div>
          )}

          {searchError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 font-mono text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {!searchLoading && hasSearched && searchResults.length === 0 && (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h3 className="font-display font-bold text-sm text-white uppercase">No competitors found</h3>
              <p className="font-mono text-xs text-slate-400 mt-1">
                No active competitors match "{searchQuery}". Check the spelling or try a different handle.
              </p>
            </div>
          )}

          {!searchLoading && !hasSearched && searchQuery.trim().length !== 1 && (
            <div className="p-8 text-center bg-[#091522]/60 border border-white/5 rounded-xl">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h3 className="font-display font-bold text-sm text-slate-300 uppercase">
                Discover Competitors
              </h3>
              <p className="font-body text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Type a handle or competitor name above to inspect public stats, send friend requests, and build your arena circle.
              </p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-xs font-mono text-slate-400">
                <span>MATCHES ({searchResults.length})</span>
                <span>SERVER AUTHORITATIVE</span>
              </div>
              {searchResults.map((user) => (
                <UserSocialCard
                  key={user.id}
                  user={{
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    bio: user.bio,
                    level: user.level,
                    level_title: user.level_title,
                    total_xp: user.total_xp,
                    solved_count: user.solved_count,
                    is_caller: user.is_caller,
                    friendship_status: user.friendship_status || 'none',
                    friend_request_id: user.friend_request_id,
                  }}
                  mode="search"
                  onSendFriendRequest={handleSendFriendRequest}
                  onAcceptRequest={handleAcceptRequest}
                  onRejectRequest={handleRejectRequest}
                  onCancelRequest={handleCancelRequest}
                  onRemoveFriend={openRemoveFriendModal}
                  onBlock={openBlockModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FRIENDS */}
      {activeTab === 'friends' && (
        <div className="space-y-3">
          {friendsLoading ? (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-[#ffd43b] mx-auto mb-2" />
              <p className="font-mono text-xs text-slate-400">Loading friends list...</p>
            </div>
          ) : friendsList.length === 0 ? (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <HeartHandshake className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h3 className="font-display font-bold text-sm text-white uppercase">No Friends Yet</h3>
              <p className="font-mono text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Search for competitors in the "Find" tab or send friend requests from public profiles to grow your network!
              </p>
              <button
                type="button"
                onClick={() => handleTabChange('find')}
                className="mt-4 px-4 py-2 bg-[#ffd43b] text-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase cursor-pointer"
              >
                Find Friends →
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-xs font-mono text-slate-400">
                <span>FRIENDS ({friendsList.length})</span>
                <span>MUTUAL CONNECTIONS</span>
              </div>
              {friendsList.map((friend) => (
                <UserSocialCard
                  key={friend.id}
                  user={{
                    id: friend.id,
                    username: friend.username,
                    display_name: friend.display_name,
                    avatar_url: friend.avatar_url,
                    bio: friend.bio,
                    level: friend.level,
                    level_title: friend.level_title,
                    total_xp: friend.total_xp,
                    solved_count: friend.solved_count,
                    friendship_status: 'friend',
                    friends_since: friend.friends_since,
                  }}
                  mode="friend"
                  onRemoveFriend={openRemoveFriendModal}
                  onBlock={openBlockModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FRIEND REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Requests Sub-nav */}
          <div className="flex items-center gap-2 bg-[#091522] p-1 rounded-xl border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setRequestsSubTab('incoming')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                requestsSubTab === 'incoming'
                  ? 'bg-[#ffd43b] text-[#0c1d2d]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Incoming ({incomingRequests.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRequestsSubTab('outgoing')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                requestsSubTab === 'outgoing'
                  ? 'bg-[#ffd43b] text-[#0c1d2d]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Sent ({outgoingRequests.length})</span>
            </button>
          </div>

          {requestsLoading ? (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-[#ffd43b] mx-auto mb-2" />
              <p className="font-mono text-xs text-slate-400">Loading friend requests...</p>
            </div>
          ) : requestsSubTab === 'incoming' ? (
            incomingRequests.length === 0 ? (
              <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
                <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <h3 className="font-display font-bold text-sm text-white uppercase">No Incoming Requests</h3>
                <p className="font-mono text-xs text-slate-400 mt-1">
                  You don't have any pending friend requests at this time.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="px-1 text-xs font-mono text-slate-400">
                  <span>PENDING INCOMING REQUESTS ({incomingRequests.length})</span>
                </div>
                {incomingRequests.map((req) => (
                  <UserSocialCard
                    key={req.request_id}
                    user={{
                      id: req.sender.id,
                      username: req.sender.username,
                      display_name: req.sender.display_name,
                      avatar_url: req.sender.avatar_url,
                      bio: req.sender.bio,
                      level: req.sender.level,
                      level_title: req.sender.level_title,
                      total_xp: req.sender.total_xp,
                      solved_count: req.sender.solved_count,
                      friendship_status: 'incoming_pending',
                      friend_request_id: req.request_id,
                    }}
                    mode="incoming_request"
                    onAcceptRequest={handleAcceptRequest}
                    onRejectRequest={handleRejectRequest}
                    onBlock={openBlockModal}
                  />
                ))}
              </div>
            )
          ) : outgoingRequests.length === 0 ? (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Send className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h3 className="font-display font-bold text-sm text-white uppercase">No Sent Requests</h3>
              <p className="font-mono text-xs text-slate-400 mt-1">
                You haven't sent any pending friend requests.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="px-1 text-xs font-mono text-slate-400">
                <span>PENDING SENT REQUESTS ({outgoingRequests.length})</span>
              </div>
              {outgoingRequests.map((req) => (
                <UserSocialCard
                  key={req.request_id}
                  user={{
                    id: req.recipient.id,
                    username: req.recipient.username,
                    display_name: req.recipient.display_name,
                    avatar_url: req.recipient.avatar_url,
                    bio: req.recipient.bio,
                    level: req.recipient.level,
                    level_title: req.recipient.level_title,
                    total_xp: req.recipient.total_xp,
                    solved_count: req.recipient.solved_count,
                    friendship_status: 'outgoing_pending',
                    friend_request_id: req.request_id,
                  }}
                  mode="outgoing_request"
                  onCancelRequest={handleCancelRequest}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BLOCKED */}
      {activeTab === 'blocked' && (
        <div className="space-y-3">
          {blockedLoading ? (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-[#ffd43b] mx-auto mb-2" />
              <p className="font-mono text-xs text-slate-400">Loading blocked accounts...</p>
            </div>
          ) : blockedList.length === 0 ? (
            <div className="p-8 text-center bg-[#091522] border border-white/10 rounded-xl">
              <Ban className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h3 className="font-display font-bold text-sm text-white uppercase">No Blocked Competitors</h3>
              <p className="font-mono text-xs text-slate-400 mt-1">
                You haven't blocked any competitors. Blocked competitors cannot view your public profile or discover you in search.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-xs font-mono text-slate-400">
                <span>BLOCKED ACCOUNTS ({blockedList.length})</span>
              </div>
              {blockedList.map((user) => (
                <UserSocialCard
                  key={user.id}
                  user={{
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                  }}
                  mode="blocked"
                  onUnblock={handleUnblock}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove Friend Confirmation Modal */}
      {removeFriendModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#091522] border-2 border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-white">
                  Remove Friend @{removeFriendModal.username}?
                </h3>
                <span className="font-mono text-[11px] text-slate-400">Mutual Friendship Disconnection</span>
              </div>
            </div>

            <p className="font-body text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-mono text-white font-bold">@{removeFriendModal.username}</span> from your friends? You will need to send another friend request to reconnect.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() =>
                  setRemoveFriendModal({ isOpen: false, targetId: '', username: '', loading: false })
                }
                disabled={removeFriendModal.loading}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveFriend}
                disabled={removeFriendModal.loading}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-display font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {removeFriendModal.loading ? 'Removing...' : 'Remove Friend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {blockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#091522] border-2 border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-white">
                  Block Competitor @{blockModal.username}?
                </h3>
                <span className="font-mono text-[11px] text-slate-400">Isolation & Privacy Shield</span>
              </div>
            </div>

            <p className="font-body text-xs text-slate-300 leading-relaxed">
              Blocking <span className="font-mono text-white font-bold">@{blockModal.username}</span> will remove any existing friendships and pending 1v1 challenges. They will not be able to search for you or view your public profile.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() =>
                  setBlockModal({ isOpen: false, targetId: '', username: '', loading: false })
                }
                disabled={blockModal.loading}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBlock}
                disabled={blockModal.loading}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-display font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {blockModal.loading ? 'Blocking...' : 'Block Competitor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
