import { ROLE_LABEL } from '@mes/types'
import { Avatar, Button, Card, FormField, Input } from '@mes/ui'
import { ArrowRight, ClipboardList, GitBranch, Layers3, Lock, Mail, ShoppingCart } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../auth/auth'
import { LogoMark } from '../../layouts/LogoMark'
import { useStore } from '../../state/store'

const DEMO_ACCOUNTS = [
  'per-admin',
  'per-pm',
  'per-planner',
  'per-supervisor',
  'per-operator',
  'per-quality',
  'per-engineer',
  'per-marketing',
  'per-warehouse',
]

const PILLARS = [
  {
    title: 'Demand',
    text: 'Marketing orders resolve into stock allocation or a production requirement.',
    Icon: ShoppingCart,
  },
  {
    title: 'Definition',
    text: 'BOM, BOR and BOP under revision control, snapshotted on release.',
    Icon: Layers3,
  },
  {
    title: 'Execution',
    text: 'Work orders dispatched to machines, operators and shifts.',
    Icon: ClipboardList,
  },
  {
    title: 'Traceability',
    text: 'Every bar traced back to its lot, machine, operator and inspection.',
    Icon: GitBranch,
  },
]

export function LoginPage() {
  const { state } = useStore()
  const { user, signIn } = useAuth()
  const location = useLocation()
  const [destination, setDestination] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={destination ?? from} replace />

  const accounts = DEMO_ACCOUNTS.map((id) => state.people.find((p) => p.id === id)).filter((p) => !!p)

  const enter = (personId: string, destination = '/') => {
    setDestination(destination)
    signIn(personId)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const person = state.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase())
    if (!person || !password) {
      setError('Use one of the demo accounts below. Any password works.')
      return
    }
    enter(person.id, from)
  }

  return (
    <div className="px-4 py-8 sm:py-12 relative min-h-dvh overflow-hidden bg-surface">
      <div aria-hidden className="inset-0 pointer-events-none absolute overflow-hidden">
        <div
          className="blur-xl absolute -top-[20%] -right-[10%] h-[80%] w-[70%] opacity-70"
          style={{
            background: 'radial-gradient(40% 40% at 70% 30%, rgb(237 28 36 / 0.10), transparent 70%)',
          }}
        />
      </div>
      <div className="max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_1.1fr] relative mx-auto grid w-full grid-cols-1">
        <Card variant="ink" className="gap-10 p-8 flex flex-col justify-between">
          <div className="gap-3 flex items-center">
            <span className="size-11 rounded-2xl bg-white/5 flex items-center justify-center">
              <LogoMark className="size-7" />
            </span>
            <div>
              <p className="font-bold leading-tight text-[15px]">MES</p>
              <p className="text-xs text-on-ink-muted">{state.company.name}</p>
            </div>
          </div>
          <div>
            <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">
              Manufacturing operations platform
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              From customer demand to manufacturing reality<span className="text-accent">.</span>
            </h1>
            <div className="mt-8 space-y-3">
              {PILLARS.map(({ title, text, Icon }) => (
                <div key={title} className="gap-3 rounded-2xl bg-white/5 p-3 flex items-start">
                  <span className="mt-0.5 size-8 rounded-xl bg-white/10 flex shrink-0 items-center justify-center">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="text-sm font-semibold block">{title}</span>
                    <span className="text-xs block text-on-ink-muted">{text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-on-ink-muted">
            Demo data: Refinery Jakarta and Plant Surabaya, Wednesday 23 September 2026.
          </p>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Sign in<span className="text-accent">.</span>
          </h2>
          <p className="mt-1 text-sm text-muted">Pick a demo account to see the platform from that role.</p>

          <form onSubmit={submit} className="mt-6 gap-4 grid grid-cols-1">
            <FormField label="Email" htmlFor="login-email" error={error || undefined}>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                leftIcon={<Mail />}
                inputClassName="h-12"
                placeholder="ratna@logammulia.co.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <FormField label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                leftIcon={<Lock />}
                inputClassName="h-12"
                placeholder="Any password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" size="lg" className="w-full">
              Sign in
              <ArrowRight />
            </Button>
          </form>

          <p className="mb-2 mt-8 font-semibold tracking-wider text-[11px] text-muted uppercase">
            Demo accounts
          </p>
          <div className="gap-2 sm:grid-cols-2 grid grid-cols-1">
            {accounts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => enter(p.id)}
                className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 text-left transition-colors hover:bg-surface active:scale-[0.98]"
              >
                <Avatar name={p.name} color={p.color} size="md" />
                <span className="min-w-0">
                  <span className="text-sm font-semibold block truncate">{p.name}</span>
                  <span className="text-xs block truncate text-muted">
                    {ROLE_LABEL[p.role]} ·{' '}
                    {p.siteIds.length > 1
                      ? 'Both sites'
                      : state.sites.find((s) => s.id === p.siteIds[0])?.name}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
