import { createClient } from 'npm:@supabase/supabase-js@2.99.0'

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error('Missing configuration: ' + name)
  return value
}

export function adminClient() {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  const secret =
    (keys ? JSON.parse(keys).default : undefined) ||
    Deno.env.get('SUPABASE_SECRET_KEY') ||
    env('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(env('SUPABASE_URL'), secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function appUrl(): URL {
  const url = new URL(env('WORK_APP_URL'))
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  ) {
    throw new Error('Invalid application URL')
  }
  if (url.username || url.password) throw new Error('Invalid application URL')
  return url
}

export function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
