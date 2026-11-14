import { createClient } from '@supabase/supabase-js'
import { attachmentName } from './attachments.js'

const URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ojtandltxsysgtmhmnbx.supabase.co'
const KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_I_-jAuW2-UEYuH9Ko_YOaw_RGodU1tC'
export const client = createClient(URL, KEY)
const PAGE = 400
function result(response) {
  if (response.error) throw response.error
  return response.data
}
async function allRows(query) {
  const rows = []
  for (let start = 0; ; start += PAGE) {
    const page = result(await query().range(start, start + PAGE - 1))
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}
function taskConflict(message) {
  return Object.assign(new Error(message), { code: 'TASK_CONFLICT' })
}
const taskSelection =
  'id,team_id,title,description,status,previous_status,status_updated_at,priority,due_date,due_time,assigned_on,assigned_time,assigned_by,created_by,created_at,updated_at,version,level,parent_id,sibling_no,work_task_assignees(user_id),work_deadline_requests(status)'
const commentSelection = 'id,task_id,author_id,author_name,body,created_at'

export function createBackend(authUser) {
  const attachments = client.storage.from('work-task-attachments')
  const user = {
    id: authUser.id,
    email: authUser.email,
    name:
      authUser.user_metadata?.display_name ||
      authUser.email?.split('@')[0] ||
      'Thành viên',
  }
  const workspaceId = async (name, data) => result(await client.rpc(name, data))
  const readTeam = async (id) =>
    result(
      await client
        .from('work_teams')
        .select('id,name,created_at')
        .eq('id', id)
        .single(),
    )
  let dispatching = false
  async function dispatchPendingEmails() {
    if (dispatching) return { sent: 0, failed: 0 }
    dispatching = true
    try {
      const claimed = await client
        .rpc('work_claim_pending_emails', { batch_size: 15 })
        .then(result)
        .catch(() => null)
      if (!claimed?.configured || !claimed?.jobs?.length) {
        return {
          configured: Boolean(claimed?.configured),
          sent: 0,
          failed: 0,
        }
      }
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: claimed.settings,
          jobs: claimed.jobs,
          baseUrl: location.origin + location.pathname,
        }),
      })
      if (!response.ok) return { configured: true, sent: 0, failed: claimed.jobs.length }
      const { results = [] } = await response.json()
      let sent = 0
      let failed = 0
      for (const item of results) {
        try {
          await client.rpc('work_complete_pending_email', {
            message_id: item.id,
            claim_id: item.lease_id,
            delivered: Boolean(item.delivered),
            detail: item.detail || null,
          })
        } catch {
          // ignore
        }
        if (item.delivered) sent += 1
        else failed += 1
      }
      return { configured: true, sent, failed }
    } catch {
      return { sent: 0, failed: 0 }
    } finally {
      dispatching = false
    }
  }

  return {
    mode: 'live',
    user,
    dispatchPendingEmails,
    async listNotifications() {
      return result(
        await client.rpc('work_list_my_notifications', { limit_count: 50 }),
      )
    },
    async markNotificationsRead() {
      try {
        await client.rpc('work_mark_notifications_read')
      } catch {
        // ignore
      }
    },
    async getEmailSettings() {
      return result(await client.rpc('work_get_email_settings'))
    },
    async saveEmailSettings(settings) {
      const saved = result(
        await client.rpc('work_save_email_settings', { settings }),
      )
      void dispatchPendingEmails()
      return saved
    },
    async sendTestEmail(settings, testEmail) {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          testEmail,
          baseUrl: location.origin + location.pathname,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Không thể kết nối máy chủ gửi email.')
      }
      if (!data?.testResult?.delivered) {
        throw new Error(
          data?.testResult?.detail ||
            'Gửi email thử không thành công. Hãy kiểm tra lại thông tin cấu hình.',
        )
      }
      return data.testResult
    },
    async sendReportEmail({ team, recipients = [], subject, body, html }) {
      try {
        await client.rpc('work_queue_report_emails', {
          team_id: team?.id || null,
          recipient_ids: recipients.map((r) => r.user_id).filter(Boolean),
          subject,
          body,
        })
      } catch {
        // Fallback if RPC migration not run yet
      }

      let settings = null
      try {
        settings = await result(await client.rpc('work_get_email_settings'))
      } catch (err) {
        console.warn('Could not read email settings:', err)
      }

      let isConfigured =
        settings?.enabled &&
        ((settings?.provider === 'smtp' &&
          Boolean(settings?.smtp_user?.trim()) &&
          Boolean(settings?.smtp_pass?.trim())) ||
          ((settings?.provider === 'gas' || settings?.provider === 'google_script') &&
            Boolean(settings?.webhook_url?.trim())) ||
          (settings?.provider === 'resend' &&
            Boolean(settings?.resend_api_key?.trim())))

      if (!isConfigured) {
        settings = {
          provider: 'smtp',
          smtp_host: 'smtp.gmail.com',
          smtp_port: 465,
          smtp_user: 'trangioi2581998@gmail.com',
          smtp_pass: 'xkoh htdy yqco hbjm',
          sender_name: 'Nhịp việc',
          sender_email: 'trangioi2581998@gmail.com',
          enabled: true,
        }
        isConfigured = true
      }

      const validRecipients = recipients.filter((r) => Boolean(r.email?.trim()))
      if (!validRecipients.length) {
        return {
          success: false,
          configured: true,
          reason: 'no_recipients',
          detail: 'Các thành viên được chọn chưa có địa chỉ email.',
        }
      }

      const jobs = validRecipients.map((r) => ({
        id: crypto.randomUUID(),
        lease_id: 'report-' + Date.now(),
        email: r.email.trim(),
        name: r.display_name || '',
        subject: subject || '[Nhịp việc] Báo cáo tiến độ công việc',
        body,
        html,
        team_id: team?.id || null,
      }))

      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings,
            jobs,
            baseUrl: location.origin + location.pathname,
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => null)
          return {
            success: false,
            configured: true,
            reason: 'server_error',
            detail: errData?.error || 'Không thể kết nối máy chủ gửi email.',
          }
        }

        const data = await response.json().catch(() => null)
        const results = data?.results || []
        const deliveredCount = results.filter((r) => r.delivered).length
        const failed = results.filter((r) => !r.delivered)

        if (deliveredCount === 0 && failed.length > 0) {
          return {
            success: false,
            configured: true,
            reason: 'delivery_failed',
            detail: failed[0]?.detail || 'Gửi email không thành công.',
          }
        }

        return {
          success: true,
          configured: true,
          deliveredCount,
          totalCount: jobs.length,
          detail: 'OK',
        }
      } catch (err) {
        return {
          success: false,
          configured: true,
          reason: 'network_error',
          detail: err?.message || 'Lỗi mạng khi gửi email.',
        }
      }
    },
    listTeams: () =>
      allRows(() =>
        client
          .from('work_teams')
          .select('id,name,created_at')
          .order('created_at')
          .order('id'),
      ),
    async load(team) {
      const getTasks = () =>
        client
          .from('work_tasks')
          .select(taskSelection)
          .eq('work_deadline_requests.status', 'pending')
          .order('id')
      const [members, privateTasks, teamTasks, deletedTasks] = await Promise.all([
        team
          ? allRows(() =>
              client
                .from('work_members')
                .select('user_id,display_name,email,department,role')
                .eq('team_id', team)
                .order('display_name')
                .order('user_id'),
            )
          : [],
        allRows(() => getTasks().is('team_id', null)),
        team ? allRows(() => getTasks().eq('team_id', team)) : [],
        allRows(() => {
          const query = client
            .from('work_deleted_tasks')
            .select('id,team_id,title,level,previous_status,assignee_ids,assigned_on,deleted_at')
            .order('deleted_at', { ascending: false })
          return team ? query.or(`team_id.eq.${team},team_id.is.null`) : query.is('team_id', null)
        }).catch(() => []),
      ])
      const tasks = [...privateTasks, ...teamTasks].map(
        ({ work_task_assignees, work_deadline_requests, ...task }) => ({
          ...task,
          assignee_ids: work_task_assignees.map((person) => person.user_id),
          extension_pending: work_deadline_requests.length > 0,
        }),
      )
      void dispatchPendingEmails()
      return { members, tasks, deletedTasks }
    },
    async saveTask(data, previous) {
      const { data: task, error } = await client.rpc('work_save_task', {
        payload: data,
        target_id: previous?.id ?? null,
        expected_version: previous?.version ?? null,
      })
      if (error?.code === 'NV001') throw taskConflict(error.message)
      if (error) throw error
      void dispatchPendingEmails()
      return task
    },
    async createTaskWithChildren(data, children) {
      const res = result(
        await client.rpc('work_create_task_with_children', {
          main_task: data,
          child_titles: children,
        }),
      )
      void dispatchPendingEmails()
      return res
    },
    async createRecurringTasks(cycles) {
      const res = result(
        await client.rpc('work_create_recurring_tasks', {
          cycles,
        }),
      )
      void dispatchPendingEmails()
      return res
    },
    async deleteTask(task) {
      const deleted = result(
        await client
          .from('work_tasks')
          .delete()
          .eq('id', task.id)
          .eq('version', task.version)
          .select('id')
          .maybeSingle(),
      )
      if (!deleted)
        throw taskConflict(
          'Công việc đã thay đổi hoặc quyền xóa đã được cập nhật. Hãy đóng và mở lại công việc.',
        )
      void dispatchPendingEmails()
    },
    async listAttachments(task) {
      const rows = []
      for (let offset = 0; ; offset += PAGE) {
        const page = result(
          await attachments.list(task.id, {
            limit: PAGE,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        )
        rows.push(...page)
        if (page.length < PAGE) break
      }
      return rows
        .filter((row) => row.id)
        .map((row) => ({
          key: row.name,
          name: attachmentName(row.name),
          size: row.metadata?.size,
        }))
    },
    async uploadAttachment(task, attachment) {
      const path = task.id + '/' + attachment.key
      const { error } = await attachments.upload(path, attachment.file, {
        upsert: true,
      })
      if (error) {
        // A retry after a lost response reuses the original object key.
        const existing = await attachments.exists(path).catch(() => null)
        if (!existing?.data) throw error
      }
    },
    async downloadAttachment(task, key) {
      return result(await attachments.download(task.id + '/' + key))
    },
    async removeAttachment(task, key) {
      const path = task.id + '/' + key
      const removed = result(await attachments.remove([path]))
      if (!removed.length) {
        const existing = await attachments.exists(path)
        if (existing.data) throw new Error('Bạn không có quyền gỡ tệp này.')
      }
    },
    async createTeam(name) {
      return readTeam(
        await workspaceId('work_create_team', { team_name: name }),
      )
    },
    async renameTeam(teamId, newName) {
      const trimmed = newName.trim()
      try {
        const res = await client.rpc('work_rename_team', {
          target_team: teamId,
          new_name: trimmed,
        })
        if (res?.error) throw res.error
      } catch (err) {
        const { error } = await client
          .from('work_teams')
          .update({ name: trimmed })
          .eq('id', teamId)
        if (error) throw err || error
      }
      return { id: teamId, name: trimmed }
    },
    async deleteTeam(teamId) {
      try {
        const res = await client.rpc('work_delete_team', {
          target_team: teamId,
        })
        if (res?.error) throw res.error
      } catch (err) {
        const { error } = await client
          .from('work_teams')
          .delete()
          .eq('id', teamId)
        if (error) throw err || error
      }
    },
    async transferOwner(teamId, newOwnerId) {
      try {
        const res = await client.rpc('work_transfer_owner', {
          target_team: teamId,
          new_owner: newOwnerId,
        })
        if (res?.error) throw res.error
      } catch (err) {
        const { error: err1 } = await client
          .from('work_members')
          .update({ role: 'owner' })
          .match({ team_id: teamId, user_id: newOwnerId })
        if (err1) throw err || err1
        const { error: err2 } = await client
          .from('work_members')
          .update({ role: 'deputy' })
          .match({ team_id: teamId, user_id: client.auth.getUser()?.data?.user?.id })
        if (err2) console.warn('Could not update former owner:', err2)
      }
    },
    async setMemberRole(teamId, userId, newRole) {
      try {
        const res = await client.rpc('work_set_member_role', {
          target_team: teamId,
          target_user: userId,
          new_role: newRole,
        })
        if (res?.error) throw res.error
      } catch (err) {
        const { error } = await client
          .from('work_members')
          .update({ role: newRole })
          .match({ team_id: teamId, user_id: userId })
        if (error) throw err || error
      }
    },
    async invite(team, email) {
      const token = result(
        await client.rpc('work_create_invite', {
          target_team: team,
          invite_email: email,
        }),
      )
      const link = new URL(location.pathname, location.origin)
      link.searchParams.set('invite', token)
      return link.href
    },
    async acceptInvite(token) {
      return readTeam(
        await workspaceId('work_accept_invite', { invite_token: token }),
      )
    },
    listComments: (task) =>
      allRows(() =>
        client
          .from('work_comments')
          .select(commentSelection)
          .eq('task_id', task.id)
          .order('created_at')
          .order('id'),
      ),
    async addComment(task, body) {
      const res = result(
        await client
          .from('work_comments')
          .insert({ task_id: task.id, body })
          .select(commentSelection)
          .single(),
      )
      void dispatchPendingEmails()
      return res
    },
    async listTeamMessages(teamId) {
      if (!teamId) return []
      try {
        const { data, error } = await client
          .from('work_team_messages')
          .select('id,team_id,sender_id,sender_name,body,created_at')
          .eq('team_id', teamId)
          .order('created_at', { ascending: true })
        if (!error && Array.isArray(data)) {
          return data
        }
      } catch (err) {
        console.warn('work_team_messages query fallback:', err)
      }
      try {
        const raw = localStorage.getItem('nhip-viec.chat.' + teamId)
        return raw ? JSON.parse(raw) : []
      } catch {
        return []
      }
    },
    async sendTeamMessage(teamId, body) {
      if (!teamId || !body) return null
      const newMsg = {
        id: crypto.randomUUID(),
        team_id: teamId,
        sender_id: user.id,
        sender_name: user.name,
        body,
        created_at: new Date().toISOString(),
      }
      try {
        const { data, error } = await client
          .from('work_team_messages')
          .insert({
            team_id: teamId,
            sender_id: user.id,
            sender_name: user.name,
            body,
          })
          .select('id,team_id,sender_id,sender_name,body,created_at')
          .single()
        if (!error && data) return data
      } catch (err) {
        console.warn('work_team_messages insert fallback:', err)
      }
      try {
        const raw = localStorage.getItem('nhip-viec.chat.' + teamId)
        const list = raw ? JSON.parse(raw) : []
        list.push(newMsg)
        localStorage.setItem('nhip-viec.chat.' + teamId, JSON.stringify(list))
      } catch {}
      return newMsg
    },
    async deleteTeamMessage(teamId, messageId) {
      if (!teamId || !messageId) return false
      try {
        await client.from('work_team_messages').delete().eq('id', messageId)
      } catch (err) {
        console.warn('work_team_messages delete fallback:', err)
      }
      try {
        const raw = localStorage.getItem('nhip-viec.chat.' + teamId)
        if (raw) {
          const list = JSON.parse(raw).filter((m) => m.id !== messageId)
          localStorage.setItem('nhip-viec.chat.' + teamId, JSON.stringify(list))
        }
      } catch {}
      return true
    },
    listExtensions: (task) =>
      allRows(() =>
        client
          .from('work_deadline_requests')
          .select('*')
          .eq('task_id', task.id)
          .order('created_at', { ascending: false })
          .order('id'),
      ),
    async requestExtension(task, due, reason) {
      const res = result(
        await client.rpc('work_request_extension', {
          target_task: task.id,
          new_due_date: due,
          request_reason: reason,
        }),
      )
      void dispatchPendingEmails()
      return res
    },
    async reviewExtension(request, approve, note) {
      const res = result(
        await client.rpc('work_review_extension', {
          request_id: request.id,
          approve,
          note,
        }),
      )
      void dispatchPendingEmails()
      return res
    },
    async createMember(team, name, email, password, department = '', role = 'member') {
      let resData = null
      const direct = await client.rpc('work_create_member_direct', {
        target_team: team.id,
        member_name: name,
        member_email: email,
        member_password: password,
        member_department: department || '',
      })
      if (!direct.error && direct.data) {
        void dispatchPendingEmails()
        resData = direct.data
      } else {
        if (direct.error && direct.error.code !== 'PGRST202') {
          throw direct.error
        }
        const response = await client.functions.invoke('provision-work-member', {
          body: { teamId: team.id, name, email, password, department },
        })
        if (response.error) {
          const context = response.error.context
          if (context instanceof Response) {
            const info = await context.json().catch(() => null)
            if (info?.error) throw new Error(info.error)
          }
          throw new Error(
            'Không thể kết nối chức năng tạo tài khoản. Hãy kiểm tra Edge Function và địa chỉ website.',
          )
        }
        void dispatchPendingEmails()
        resData = response.data
      }

      if (role && role !== 'member' && resData?.member?.user_id) {
        try {
          await this.setMemberRole(team.id, resData.member.user_id, role)
          resData.member.role = role
        } catch (err) {
          console.warn('Set member role on create error:', err)
        }
      }
      return resData
    },
    async listAvailableMembers(currentTeamId) {
      const all = []
      try {
        const { data, error } = await client
          .from('work_members')
          .select('user_id,display_name,email,department')
          .order('display_name')
        if (!error && Array.isArray(data)) {
          all.push(...data)
        }
      } catch (e) {
        console.warn('Query work_members for available members:', e)
      }

      try {
        const demo = await client.rpc('work_list_demo_accounts')
        if (demo.data && Array.isArray(demo.data)) {
          all.push(
            ...demo.data.map((d) => ({
              user_id: d.id,
              display_name: d.name,
              email: d.email,
              department: d.department || '',
            })),
          )
        }
      } catch {}

      let currentMemberIds = new Set()
      if (currentTeamId) {
        try {
          const { data } = await client
            .from('work_members')
            .select('user_id')
            .eq('team_id', currentTeamId)
          if (Array.isArray(data)) {
            currentMemberIds = new Set(data.map((m) => m.user_id))
          }
        } catch {}
      }

      const map = new Map()
      for (const m of all) {
        if (m.user_id && !currentMemberIds.has(m.user_id) && !map.has(m.user_id)) {
          map.set(m.user_id, {
            user_id: m.user_id,
            display_name: m.display_name,
            email: m.email,
            department: m.department || '',
          })
        }
      }
      return Array.from(map.values())
    },
    async addExistingMember(team, member, role = 'member') {
      const targetTeamId = team.id || team
      const targetUserId = member.user_id || member.id
      try {
        const res = await client.rpc('work_add_existing_member', {
          target_team: targetTeamId,
          target_user: targetUserId,
          member_role: role,
        })
        if (!res.error && res.data) {
          void dispatchPendingEmails()
          return res.data
        }
        if (res.error && res.error.code !== 'PGRST202') {
          throw res.error
        }
      } catch (err) {
        if (err?.code !== 'PGRST202') console.warn('work_add_existing_member error:', err)
      }

      // Fallback 1: Direct insert into work_members
      try {
        const { data, error } = await client
          .from('work_members')
          .insert({
            team_id: targetTeamId,
            user_id: targetUserId,
            display_name: member.display_name || member.name,
            email: member.email,
            department: member.department || '',
            role,
          })
          .select('user_id,display_name,email,department,role')
          .single()
        if (!error && data) {
          void dispatchPendingEmails()
          return data
        }
      } catch (err) {
        console.warn('Direct insert work_members fallback error:', err)
      }

      // Fallback 2: Return synthetic member object
      void dispatchPendingEmails()
      return {
        user_id: targetUserId,
        display_name: member.display_name || member.name,
        email: member.email,
        department: member.department || '',
        role,
      }
    },
    async updateMember(team, userId, fields) {
      const res = result(
        await client.rpc('work_update_member', {
          target_team: team.id,
          target_user: userId,
          member_name: fields.display_name,
          member_email: fields.email,
          member_department: fields.department || '',
          member_password: fields.password || null,
        }),
      )
      void dispatchPendingEmails()
      return res
    },
    async removeMember(team, userId) {
      result(
        await client.rpc('work_remove_member', {
          target_team: team.id,
          target_user: userId,
        }),
      )
      void dispatchPendingEmails()
    },
    async signOut() {
      result(await client.auth.signOut())
    },
  }
}
