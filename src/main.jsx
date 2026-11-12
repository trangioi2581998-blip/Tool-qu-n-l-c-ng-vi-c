import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import App from './App.jsx'
import {
  authenticateDemo,
  createDemo,
  demoAccounts,
  getDemoSession,
  registerDemo,
  resetDemoPassword,
  setDemoSession,
} from './demo.js'
import { Avatar, Brand, ErrorText, HeroArt, readableError } from './ui.jsx'
import './styles.css'

const labels = {
  login: {
    title: 'Chào mừng bạn trở lại',
    description: 'Đăng nhập để xem công việc của bạn.',
    action: 'Đăng nhập',
  },
  signup: {
    title: 'Tạo tài khoản',
    description: 'Dùng email làm việc để tham gia cùng đồng đội.',
    action: 'Đăng ký',
  },
  reset: {
    title: 'Quên mật khẩu?',
    description: 'Nhập email để nhận liên kết đặt lại mật khẩu.',
    action: 'Gửi liên kết',
  },
  recovery: {
    title: 'Đặt mật khẩu mới',
    description: 'Dùng ít nhất 8 ký tự cho mật khẩu mới.',
    action: 'Lưu mật khẩu',
  },
}
function AuthFrame({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <Brand />
        <div>
          <h1>
            Mỗi việc
            <br />
            đúng nhịp.
          </h1>
          <p>
            Lên kế hoạch cho việc của bạn.
            <br />
            Theo dõi tiến độ cùng đồng đội.
          </p>
        </div>
        <HeroArt />
      </section>
      <section className="auth-side">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  )
}
function AuthForm({ client, invite, recovery, onRecovered }) {
  const [mode, setMode] = useState('login')
  const active = recovery ? 'recovery' : mode
  const { title, description, action } = labels[active]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState([])
  useEffect(() => {
    client
      .rpc('work_list_demo_accounts')
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) setAccounts(data)
      })
      .catch(() => {})
  }, [client])
  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
  }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const returnUrl = new URL(
        location.pathname + location.search,
        location.origin,
      )
      returnUrl.searchParams.delete('setup')
      let result
      if (active === 'login')
        result = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
      if (active === 'signup') {
        const directReg = await client.rpc('work_register_account', {
          user_name: name.trim(),
          user_email: email.trim(),
          user_password: password,
          user_department: department.trim(),
        })
        if (!directReg.error) {
          result = await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        } else if (directReg.error.code === 'PGRST202') {
          result = await client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: returnUrl.href,
              data: { display_name: name.trim() },
            },
          })
        } else {
          throw directReg.error
        }
      }
      if (active === 'reset') {
        if (password && password.length >= 6) {
          const directReset = await client.rpc('work_reset_password_direct', {
            user_email: email.trim(),
            new_password: password,
          })
          if (!directReset.error) {
            setInfo('Đã đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.')
            setMode('login')
            setBusy(false)
            return
          }
        }
        result = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: returnUrl.href,
        })
      }
      if (active === 'recovery')
        result = await client.auth.updateUser({ password })
      if (result?.error) throw result.error
      if (active === 'signup' && !result?.data?.session)
        setInfo(
          'Kiểm tra email để xác nhận tài khoản. Sau đó quay lại đây để đăng nhập.',
        )
      if (active === 'reset')
        setInfo(
          'Nếu email đã đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
        )
      if (active === 'recovery') onRecovered()
    } catch (error) {
      const localized = {
        invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
        email_not_confirmed: 'Hãy xác nhận email trước khi đăng nhập.',
        over_email_send_rate_limit:
          'Bạn đã gửi yêu cầu quá nhanh. Hãy thử lại sau.',
      }
      setError(localized[error.code] || readableError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthFrame>
      <span className="auth-icon">
        <LockKeyhole size={22} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {invite && !recovery && (
        <p className="auth-invite">
          Bạn có lời mời. Hãy dùng email đã nhận lời mời.
        </p>
      )}
      <form className="auth-form" onSubmit={submit}>
        {active === 'signup' && (
          <>
            <label>
              Họ và tên
              <input
                required
                maxLength={80}
                placeholder="Nhập họ và tên…"
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Phòng ban
              <input
                maxLength={120}
                placeholder="VD: Product & CX, Kỹ thuật…"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </label>
          </>
        )}
        {active !== 'recovery' && (
          <label>
            Email
            <input
              required
              type="email"
              maxLength={254}
              placeholder="ten@congty.vn"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}
        <label>
          {active === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
          <input
            required
            type="password"
            placeholder={
              active === 'reset'
                ? 'Nhập mật khẩu mới (tối thiểu 6 ký tự)…'
                : 'Nhập mật khẩu…'
            }
            value={password}
            minLength={active === 'login' ? undefined : 6}
            autoComplete={
              active === 'login' ? 'current-password' : 'new-password'
            }
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {active === 'login' && (
          <button
            className="link-button auth-reset"
            type="button"
            onClick={() => switchMode('reset')}
          >
            Quên mật khẩu?
          </button>
        )}
        <ErrorText message={error} />
        {info && (
          <p className="auth-info" role="status">
            <CheckCircle2 size={17} />
            {info}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang xử lý…' : action}
          <ArrowRight size={17} />
        </button>
      </form>
      {!recovery &&
        (active === 'login' ? (
          <p className="auth-footer">
            Bạn chưa có tài khoản?{' '}
            <button
              className="link-button"
              onClick={() => switchMode('signup')}
            >
              Đăng ký
            </button>
          </p>
        ) : (
          <p className="auth-footer">
            <button className="link-button" onClick={() => switchMode('login')}>
              Quay lại đăng nhập
            </button>
          </p>
        ))}
      {!recovery && active === 'login' && accounts.length > 0 && (
        <div className="auth-quick-accounts">
          <p className="auth-quick-title">
            Tài khoản trong nhóm (bấm để điền nhanh · MK: 123456)
          </p>
          <div className="auth-quick-list">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                className="auth-quick-item"
                onClick={() => {
                  setEmail(acc.email)
                  setPassword('123456')
                  setError('')
                }}
              >
                <Avatar name={acc.name} id={acc.id} size="sm" />
                <span className="auth-quick-meta">
                  <strong>{acc.name}</strong>
                  <small>{acc.email}</small>
                </span>
                <span className="auth-quick-role">{acc.roleLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthFrame>
  )
}
function Connected({ adapter }) {
  const { client, createBackend } = adapter
  const [user, setUser] = useState(undefined)
  const [recovery, setRecovery] = useState(
    () => new URLSearchParams(location.search).get('setup') === 'invite',
  )
  const invite = new URLSearchParams(location.search).get('invite') || ''
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })
    return () => data.subscription.unsubscribe()
  }, [client])
  const repo = useMemo(
    () => (user ? createBackend(user) : null),
    [createBackend, user],
  )
  if (user === undefined)
    return (
      <AuthFrame>
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      </AuthFrame>
    )
  if (!repo || recovery)
    return (
      <AuthForm
        client={client}
        invite={invite}
        recovery={Boolean(repo && recovery)}
        onRecovered={() => {
          const url = new URL(location.href)
          url.searchParams.delete('setup')
          history.replaceState(null, '', url)
          setRecovery(false)
        }}
      />
    )
  return <App key={repo.user.id} repo={repo} inviteToken={invite} />
}
function validPublicKey(key) {
  if (key.startsWith('sb_publishable_')) return true
  try {
    return (
      JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        .role === 'anon'
    )
  } catch {
    return false
  }
}
function validUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function DemoAuthForm({ accounts, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const { title, description, action } = labels[mode]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
  }

  function submit(event) {
    event.preventDefault()
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const acc = authenticateDemo(email, password)
        onAuthenticated(acc.id)
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setError('Mật khẩu phải có ít nhất 6 ký tự.')
          return
        }
        const acc = registerDemo(name, email, password, department)
        onAuthenticated(acc.id)
      } else if (mode === 'reset') {
        if (!password || password.length < 6) {
          setError('Nhập mật khẩu mới tối thiểu 6 ký tự.')
          return
        }
        resetDemoPassword(email, password)
        setInfo('Đã đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.')
        setMode('login')
      }
    } catch (err) {
      setError(readableError(err))
    }
  }

  return (
    <AuthFrame>
      <span className="auth-icon">
        <LockKeyhole size={22} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && (
          <>
            <label>
              Họ và tên
              <input
                required
                maxLength={80}
                placeholder="Nhập họ và tên…"
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Phòng ban
              <input
                maxLength={120}
                placeholder="VD: Product & CX, Kỹ thuật…"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Email
          <input
            required
            type="email"
            maxLength={254}
            placeholder="ten@congty.vn"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
          <input
            required
            type="password"
            placeholder={
              mode === 'reset'
                ? 'Nhập mật khẩu mới (tối thiểu 6 ký tự)…'
                : 'Nhập mật khẩu…'
            }
            value={password}
            minLength={mode === 'login' ? undefined : 6}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === 'login' && (
          <button
            className="link-button auth-reset"
            type="button"
            onClick={() => switchMode('reset')}
          >
            Quên mật khẩu?
          </button>
        )}
        <ErrorText message={error} />
        {info && (
          <p className="auth-info" role="status">
            <CheckCircle2 size={17} />
            {info}
          </p>
        )}
        <button className="button primary">
          {action}
          <ArrowRight size={17} />
        </button>
      </form>
      {mode === 'login' ? (
        <p className="auth-footer">
          Bạn chưa có tài khoản?{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => switchMode('signup')}
          >
            Đăng ký
          </button>
        </p>
      ) : (
        <p className="auth-footer">
          <button
            type="button"
            className="link-button"
            onClick={() => switchMode('login')}
          >
            Quay lại đăng nhập
          </button>
        </p>
      )}
      {mode === 'login' && accounts.length > 0 && (
        <div className="auth-quick-accounts">
          <p className="auth-quick-title">
            Tài khoản trong nhóm (bấm để điền nhanh)
          </p>
          <div className="auth-quick-list">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                className="auth-quick-item"
                onClick={() => {
                  setEmail(acc.email)
                  setPassword(acc.password || '123456')
                  setError('')
                }}
              >
                <Avatar name={acc.name} id={acc.id} size="sm" />
                <span className="auth-quick-meta">
                  <strong>{acc.name}</strong>
                  <small>{acc.email}</small>
                </span>
                <span className="auth-quick-role">{acc.roleLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthFrame>
  )
}

function DemoApp() {
  const [accounts, setAccounts] = useState(demoAccounts)
  const [account, setAccount] = useState(() => getDemoSession())
  const repo = useMemo(
    () => (account ? createDemo(account, setAccounts) : null),
    [account],
  )
  function selectAccount(nextId) {
    setAccounts(demoAccounts())
    setDemoSession(nextId)
    setAccount(nextId)
  }
  if (!account || !repo) {
    return (
      <DemoAuthForm
        accounts={accounts}
        onAuthenticated={(userId) => selectAccount(userId)}
      />
    )
  }
  return (
    <App
      key={account}
      repo={repo}
      demoAccounts={accounts}
      onDemoAccount={selectAccount}
    />
  )
}

const root = createRoot(document.getElementById('root'))
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ojtandltxsysgtmhmnbx.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_I_-jAuW2-UEYuH9Ko_YOaw_RGodU1tC'
if (import.meta.env.MODE === 'demo') {
  root.render(<DemoApp />)
} else if (!url || !key || !validUrl(url) || !validPublicKey(key)) {
  root.render(
    <AuthFrame>
      <h2>Kiểm tra cấu hình Supabase</h2>
      <ErrorText message="Hãy điền Project URL và Publishable key trong .env.local, sau đó khởi động lại website." />
    </AuthFrame>,
  )
} else {
  root.render(
    <AuthFrame>
      <p role="status">Đang kết nối Supabase…</p>
    </AuthFrame>,
  )
  import('./backend.js')
    .then((adapter) => root.render(<Connected adapter={adapter} />))
    .catch((error) =>
      root.render(
        <AuthFrame>
          <h2>Không thể khởi động</h2>
          <ErrorText message={readableError(error)} />
        </AuthFrame>,
      ),
    )
}
