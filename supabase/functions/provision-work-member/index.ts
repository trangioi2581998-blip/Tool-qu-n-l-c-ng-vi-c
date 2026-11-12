import { adminClient, appUrl, json } from '../_shared/server.ts'

const teamIdPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  let cors: Record<string, string> = {}
  try {
    const redirect = appUrl()
    const allowedOrigins = [
      redirect.origin,
      ...(Deno.env.get('WORK_ALLOWED_ORIGINS') || '')
        .split(',')
        .map((value) => value.trim()),
    ]
    if (origin && !allowedOrigins.includes(origin))
      return json({ error: 'Địa chỉ website chưa được cho phép.' }, 403)
    if (origin)
      cors = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      }
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST')
      return json({ error: 'Phương thức chưa được hỗ trợ.' }, 405, cors)

    const token = req.headers
      .get('authorization')
      ?.match(/^Bearer\s+(\S+)$/i)?.[1]
    if (!token) return json({ error: 'Hãy đăng nhập lại.' }, 401, cors)
    const admin = adminClient()
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user)
      return json({ error: 'Hãy đăng nhập lại.' }, 401, cors)

    let input
    try {
      input = await req.json()
    } catch {
      return json({ error: 'Thông tin tài khoản chưa hợp lệ.' }, 400, cors)
    }
    const team = typeof input?.teamId === 'string' ? input.teamId : ''
    const email =
      typeof input?.email === 'string' ? input.email.trim().toLowerCase() : ''
    const name = typeof input?.name === 'string' ? input.name.trim() : ''
    const password = typeof input?.password === 'string' ? input.password : ''
    const department =
      typeof input?.department === 'string' ? input.department.trim() : ''
    if (
      !teamIdPattern.test(team) ||
      !emailPattern.test(email) ||
      email.length > 254 ||
      !name ||
      name.length > 80
    )
      return json(
        { error: 'Hãy kiểm tra lại tên và email thành viên.' },
        400,
        cors,
      )
    if (!password.trim() || password.length < 8)
      return json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' }, 400, cors)
    if (new TextEncoder().encode(password).length > 72)
      return json(
        { error: 'Mật khẩu quá dài. Hãy dùng mật khẩu ngắn hơn.' },
        400,
        cors,
      )

    const link = (invitedNow: boolean) =>
      admin.rpc('work_link_member', {
        target_team: team,
        manager_id: auth.user!.id,
        member_email: email,
        member_name: name,
        invited_now: invitedNow,
        member_department: department,
      })
    const existing = await link(false)
    if (existing.error?.code === '42501')
      return json(
        { error: 'Chỉ trưởng nhóm có thể tạo tài khoản thành viên.' },
        403,
        cors,
      )
    if (existing.error) throw existing.error
    let member = existing.data
    let accountCreated = false
    if (!member) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { display_name: name },
        app_metadata: { work_member_confirmation: true },
      })
      if (created.error?.code === 'weak_password')
        return json(
          {
            error:
              'Mật khẩu chưa đáp ứng chính sách của nhóm. Hãy dùng mật khẩu mạnh hơn.',
          },
          400,
          cors,
        )
      if (
        created.error &&
        !['email_exists', 'user_already_exists'].includes(
          created.error.code ?? '',
        )
      )
        throw created.error

      accountCreated = Boolean(created.data.user)
      const linked = await link(accountCreated)
      if (linked.error || !linked.data)
        throw linked.error ?? new Error('Account unavailable after creation')
      member = linked.data
    }

    // Existing accounts keep their credentials. Retry confirmation for
    // accounts provisioned here if an earlier email failed or expired.
    const {
      data: { user: memberAccount },
      error: lookupError,
    } = await admin.auth.admin.getUserById(member.user_id)
    if (lookupError) throw lookupError
    let confirmation = 'not_needed'
    if (
      memberAccount?.app_metadata.work_member_confirmation === true &&
      !memberAccount.email_confirmed_at &&
      memberAccount.email?.toLowerCase() === email
    ) {
      redirect.searchParams.delete('setup')
      const sent = await admin.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirect.href },
      })
      confirmation = sent.error ? 'failed' : 'sent'
    }
    return json({ member, accountCreated, confirmation }, 200, cors)
  } catch {
    return json(
      {
        error:
          'Chưa hoàn tất thêm thành viên. Hãy kiểm tra cấu hình và thử lại.',
      },
      500,
      cors,
    )
  }
})
