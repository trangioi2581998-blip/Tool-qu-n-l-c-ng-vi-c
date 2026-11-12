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
  'id,team_id,title,description,status,previous_status,status_updated_at,priority,due_date,assigned_on,assigned_by,created_by,created_at,updated_at,version,level,parent_id,sibling_no,work_task_assignees(user_id),work_deadline_requests(status)'
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
  return {
    mode: 'live',
    user,
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
      return task
    },
    async createTaskWithChildren(data, children) {
      return result(
        await client.rpc('work_create_task_with_children', {
          main_task: data,
          child_titles: children,
        }),
      )
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
      const { error } = await attachments.upload(path, attachment.file)
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
      return result(
        await client
          .from('work_comments')
          .insert({ task_id: task.id, body })
          .select(commentSelection)
          .single(),
      )
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
      return result(
        await client.rpc('work_request_extension', {
          target_task: task.id,
          new_due_date: due,
          request_reason: reason,
        }),
      )
    },
    async reviewExtension(request, approve, note) {
      return result(
        await client.rpc('work_review_extension', {
          request_id: request.id,
          approve,
          note,
        }),
      )
    },
    async createMember(team, name, email, password, department = '') {
      const direct = await client.rpc('work_create_member_direct', {
        target_team: team.id,
        member_name: name,
        member_email: email,
        member_password: password,
        member_department: department || '',
      })
      if (!direct.error && direct.data) {
        return direct.data
      }
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
      return response.data
    },
    async updateMember(team, userId, fields) {
      return result(
        await client.rpc('work_update_member', {
          target_team: team.id,
          target_user: userId,
          member_name: fields.display_name,
          member_email: fields.email,
          member_department: fields.department || '',
          member_password: fields.password || null,
        }),
      )
    },
    async removeMember(team, userId) {
      result(
        await client.rpc('work_remove_member', {
          target_team: team.id,
          target_user: userId,
        }),
      )
    },
    async signOut() {
      result(await client.auth.signOut())
    },
  }
}
