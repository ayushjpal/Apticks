import { supabase } from '../lib/supabase'
import type {
  ModerationReport,
  ModerationMetrics,
  ModerationFilterParams,
  ModerationListResult,
  ReportStatus,
  ReportReason,
  TargetType,
} from '../types/moderation'

export class ModerationService {
  /**
   * Fetch aggregate incident counts for the staff dashboard metrics
   */
  static async fetchModerationMetrics(): Promise<ModerationMetrics> {
    try {
      const { data, error } = await supabase.rpc('staff_get_moderation_metrics')
      if (!error && data) {
        return data as ModerationMetrics
      }

      // Fallback: direct count queries if RPC is not yet applied
      const [pendingRes, reviewingRes, resolvedRes, dismissedRes, totalRes] = await Promise.all([
        supabase.from('moderation_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('moderation_reports').select('*', { count: 'exact', head: true }).eq('status', 'reviewing'),
        supabase.from('moderation_reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('moderation_reports').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
        supabase.from('moderation_reports').select('*', { count: 'exact', head: true }),
      ])

      return {
        pending: pendingRes.count ?? 0,
        reviewing: reviewingRes.count ?? 0,
        resolved: resolvedRes.count ?? 0,
        dismissed: dismissedRes.count ?? 0,
        total: totalRes.count ?? 0,
      }
    } catch (err) {
      console.warn('Unable to load moderation metrics from server:', err)
      return {
        pending: 0,
        reviewing: 0,
        resolved: 0,
        dismissed: 0,
        total: 0,
      }
    }
  }

  /**
   * Fetch paginated list of moderation reports matching filters
   */
  static async fetchModerationIncidents(
    params: ModerationFilterParams = {}
  ): Promise<ModerationListResult> {
    const {
      status = 'all',
      reason = 'all',
      search = '',
      limit = 50,
      offset = 0,
    } = params

    try {
      // 1. Try authoritative server-side RPC
      const { data, error } = await supabase.rpc('staff_list_moderation_incidents', {
        p_status: status === 'all' ? null : status,
        p_reason: reason === 'all' ? null : reason,
        p_search: search.trim() ? search.trim() : null,
        p_limit: limit,
        p_offset: offset,
      })

      if (!error && data) {
        return {
          incidents: (data.incidents || []) as ModerationReport[],
          total: data.total ?? 0,
          limit: data.limit ?? limit,
          offset: data.offset ?? offset,
        }
      }

      // 2. Fallback direct table query if RPC is not yet registered
      let query = supabase
        .from('moderation_reports')
        .select(
          `
            id,
            reporter_id,
            target_type,
            target_id,
            reason,
            description,
            status,
            moderator_notes,
            resolved_by,
            resolved_at,
            created_at,
            updated_at,
            reporter:profiles!reporter_id(id, username, display_name, avatar_url),
            resolver:profiles!resolved_by(id, username, display_name)
          `,
          { count: 'exact' }
        )

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }
      if (reason && reason !== 'all') {
        query = query.eq('reason', reason)
      }
      if (search.trim()) {
        query = query.or(
          `id.ilike.%${search.trim()}%,target_id.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
        )
      }

      const { data: rows, count, error: tableError } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (tableError) {
        throw tableError
      }

      const formatted = (rows || []).map((r: Record<string, unknown>) => ({
        ...r,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
        resolver: Array.isArray(r.resolver) ? r.resolver[0] : r.resolver,
      })) as unknown as ModerationReport[]

      return {
        incidents: formatted,
        total: count ?? 0,
        limit,
        offset,
      }
    } catch (err) {
      console.warn('Error fetching moderation incidents:', err)
      return {
        incidents: [],
        total: 0,
        limit,
        offset,
      }
    }
  }

  /**
   * Fetch single incident detail including joined target context
   */
  static async fetchIncidentDetail(reportId: string): Promise<ModerationReport | null> {
    try {
      const { data, error } = await supabase.rpc('staff_get_incident_detail', {
        p_report_id: reportId,
      })

      if (!error && data) {
        return data as ModerationReport
      }

      // Fallback direct query
      const { data: row, error: fetchErr } = await supabase
        .from('moderation_reports')
        .select(
          `
            id,
            reporter_id,
            target_type,
            target_id,
            reason,
            description,
            status,
            moderator_notes,
            resolved_by,
            resolved_at,
            created_at,
            updated_at,
            reporter:profiles!reporter_id(id, username, display_name, avatar_url),
            resolver:profiles!resolved_by(id, username, display_name)
          `
        )
        .eq('id', reportId)
        .maybeSingle()

      if (fetchErr || !row) return null

      const report: ModerationReport = {
        ...row,
        reporter: Array.isArray(row.reporter) ? row.reporter[0] : row.reporter,
        resolver: Array.isArray(row.resolver) ? row.resolver[0] : row.resolver,
      } as ModerationReport

      // Enrich with target context
      if (report.target_type === 'question') {
        const { data: q } = await supabase
          .from('questions')
          .select('id, title, prompt, category, topic, difficulty, is_active')
          .eq('id', report.target_id)
          .maybeSingle()

        report.target_context = q
          ? { ...q, type: 'question' }
          : { type: 'question', id: report.target_id, missing: true }
      } else if (report.target_type === 'contest') {
        const { data: c } = await supabase
          .from('contests')
          .select('id, slug, title, status, category, difficulty')
          .or(`id.eq.${report.target_id},slug.eq.${report.target_id}`)
          .maybeSingle()

        report.target_context = c
          ? { ...c, type: 'contest' }
          : { type: 'contest', id: report.target_id, missing: true }
      } else if (report.target_type === 'user') {
        const { data: p } = await supabase
          .from('profiles')
          .select('id, username, display_name, role, created_at')
          .or(`id.eq.${report.target_id},username.eq.${report.target_id}`)
          .maybeSingle()

        report.target_context = p
          ? { ...p, type: 'user' }
          : { type: 'user', id: report.target_id, missing: true }
      } else {
        report.target_context = { type: 'general', id: report.target_id }
      }

      return report
    } catch (err) {
      console.error('Error fetching incident detail:', err)
      return null
    }
  }

  /**
   * Authoritatively update report status via server state machine RPC
   */
  static async updateIncidentStatus(
    reportId: string,
    newStatus: ReportStatus,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('staff_update_incident_status', {
        p_report_id: reportId,
        p_new_status: newStatus,
        p_notes: notes || null,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, ...(data || {}) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update incident status.'
      return { success: false, error: msg }
    }
  }

  /**
   * Update internal moderator notes without altering status
   */
  static async updateIncidentNotes(
    reportId: string,
    notes: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('staff_update_incident_notes', {
        p_report_id: reportId,
        p_notes: notes,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, ...(data || {}) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update incident notes.'
      return { success: false, error: msg }
    }
  }

  /**
   * Create a new report (User or Staff facing)
   */
  static async submitReport(params: {
    targetType: TargetType
    targetId: string
    reason: ReportReason
    description: string
  }): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_moderation_report', {
        p_target_type: params.targetType,
        p_target_id: params.targetId,
        p_reason: params.reason,
        p_description: params.description,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, reportId: data?.report_id }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit incident report.'
      return { success: false, error: msg }
    }
  }
}
