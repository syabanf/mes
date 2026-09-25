import type { LoginMethod, Person } from '@mes/types'
import { LOGIN_METHOD_LABEL } from '@mes/types'
import { Button, FormField, Kicker, cn, toast } from '@mes/ui'
import { Delete, KeyRound, Nfc, QrCode, Radio, ScanLine } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { canUseMobile, useAuth } from '../../auth/auth'
import { OperatorPicker } from '../../components/pickers'
import { LogoMark } from '../../layouts/LogoMark'
import { useStore } from '../../state/store'

const METHODS: LoginMethod[] = ['rfid', 'nfc', 'qr', 'pin']
const METHOD_ICON: Record<LoginMethod, ReactNode> = {
  rfid: <Radio />,
  nfc: <Nfc />,
  qr: <QrCode />,
  pin: <KeyRound />,
}
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

export function LoginPage() {
  const { state } = useStore()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [method, setMethod] = useState<LoginMethod>('rfid')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const people = useMemo(() => state.people.filter(canUseMobile), [state.people])
  const operators = useMemo(() => people.filter((p) => p.role === 'operator'), [people])
  const demo = operators.slice(0, 2)

  if (user) return <Navigate to={from} replace />

  const enter = (person: Person, used: LoginMethod) => {
    signIn(person.id)
    toast(`Welcome, ${person.name}`, { tone: 'success', description: LOGIN_METHOD_LABEL[used] })
    navigate(from, { replace: true })
  }
  const submitPin = () => {
    const match = people.find((p) => p.badge === pin || p.badge.slice(-4) === pin)
    if (match) {
      enter(match, 'pin')
      return
    }
    setPinError('No operator uses that PIN. Try the last four digits of your badge.')
    setPin('')
  }
  const press = (key: (typeof KEYS)[number]) => {
    setPinError(null)
    if (key === 'clear') setPin('')
    else if (key === 'back') setPin((p) => p.slice(0, -1))
    else if (pin.length < 8) setPin((p) => p + key)
  }
  const simulate = () => {
    const person = (picked ? people.find((p) => p.id === picked) : undefined) ?? demo[0]
    if (person) enter(person, method)
  }
  const shiftName = (id: string | null) => state.shifts.find((s) => s.id === id)?.name ?? ''

  return (
    <div className="max-w-md px-6 pb-10 mx-auto min-h-dvh w-full bg-surface pt-[max(env(safe-area-inset-top),4rem)]">
      <div className="gap-3 flex items-center">
        <span className="size-11 rounded-2xl text-white flex items-center justify-center bg-ink shadow-float">
          <LogoMark className="size-7" />
        </span>
        <div>
          <p className="font-bold leading-tight text-[15px]">MES Operator</p>
          <p className="text-xs text-muted">{state.company.name}</p>
        </div>
      </div>

      <h1 className="mt-10 text-3xl font-bold tracking-tight">
        Scan your badge<span className="text-accent">.</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Choose how you identify yourself at the line.</p>

      <div role="radiogroup" aria-label="Login method" className="mt-6 gap-2 grid grid-cols-4">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={cn(
              'h-20 gap-1.5 font-semibold [&_svg]:size-6 flex flex-col items-center justify-center rounded-[20px] text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]',
              method === m ? 'bg-ink text-on-ink shadow-float' : 'bg-card text-body shadow-card',
            )}
          >
            {METHOD_ICON[m]}
            {LOGIN_METHOD_LABEL[m].split(' ')[0]}
          </button>
        ))}
      </div>

      {method === 'pin' ? (
        <div className="mt-6">
          <div
            className="h-14 gap-3 flex items-center justify-center"
            aria-live="polite"
            aria-label={`${pin.length} digits entered`}
          >
            {pin.length === 0 ? (
              <span className="text-sm text-muted">Enter your PIN</span>
            ) : (
              Array.from(pin).map((_, i) => <span key={i} className="size-3 rounded-full bg-ink" />)
            )}
          </div>
          <div className="gap-2 grid grid-cols-3">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={k === 'back' ? 'Delete last digit' : k === 'clear' ? 'Clear' : k}
                className="h-14 rounded-2xl text-xl font-semibold [&_svg]:size-5 flex items-center justify-center bg-card shadow-card transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
              >
                {k === 'back' ? <Delete /> : k === 'clear' ? <span className="text-sm">Clear</span> : k}
              </button>
            ))}
          </div>
          {pinError && (
            <p role="alert" className="mt-2 text-xs text-center text-danger">
              {pinError}
            </p>
          )}
          <Button size="lg" className="mt-3 h-14 w-full" disabled={pin.length < 4} onClick={submitPin}>
            Log in
          </Button>
          <p className="mt-2 text-xs text-center text-muted">Your badge number or its last four digits.</p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="h-40 relative flex items-center justify-center overflow-hidden rounded-[24px] bg-card shadow-card">
            <span
              aria-hidden
              className="size-24 animate-ping absolute rounded-full border-2 border-accent/40"
            />
            <span
              aria-hidden
              className="size-36 animate-pulse absolute rounded-full border border-accent/20"
            />
            <span className="size-16 [&_svg]:size-7 relative flex items-center justify-center rounded-full bg-ink text-on-ink">
              {METHOD_ICON[method]}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-center">
            Hold your {LOGIN_METHOD_LABEL[method].toLowerCase()} to the reader
          </p>
          <FormField label="Or pick an operator to simulate" className="mt-5">
            <OperatorPicker
              people={people}
              shiftName={shiftName}
              value={picked}
              onChange={setPicked}
              clearable
            />
          </FormField>
          <Button size="lg" className="mt-3 h-14 w-full" onClick={simulate}>
            <ScanLine />
            Simulate scan
          </Button>
        </div>
      )}

      {demo.length > 0 && (
        <section className="mt-8 p-4 rounded-[20px] bg-card shadow-card">
          <Kicker>Demo badges</Kicker>
          <ul className="mt-2 space-y-1.5 text-sm">
            {demo.map((p) => (
              <li key={p.id} className="gap-3 flex items-center justify-between">
                <span className="truncate">{p.name}</span>
                <span className="text-xs shrink-0 font-mono text-muted">
                  {p.badge} · PIN {p.badge.slice(-4)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Readers are simulated. Any operator, supervisor or inspector can sign in.
          </p>
        </section>
      )}
    </div>
  )
}
