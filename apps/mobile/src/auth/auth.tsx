import type { Person, Role, Site } from '@mes/types'
import { type ReactNode, createContext, useContext, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { readStorage, writeStorage } from '../lib/storage'
import { useStore } from '../state/store'

const SESSION_KEY = 'mes.mobile.session'

/** Roles that identify themselves at the line. Everyone else works in the admin console. */
const MOBILE_ROLES: Role[] = ['operator', 'supervisor', 'quality']

export const canUseMobile = (person: Person) => MOBILE_ROLES.includes(person.role)

interface Session {
  personId: string
}

interface AuthValue {
  user: Person | null
  /** The operator's home site: the first site on their record. */
  site: Site | null
  signIn: (personId: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state } = useStore()
  const [session, setSession] = useState<Session | null>(() => readStorage<Session | null>(SESSION_KEY, null))

  const value = useMemo<AuthValue>(() => {
    const person = session ? state.people.find((p) => p.id === session.personId) : undefined
    const user = person && canUseMobile(person) ? person : null
    const site = user ? (state.sites.find((s) => s.id === user.siteIds[0]) ?? null) : null
    const persist = (next: Session | null) => {
      writeStorage(SESSION_KEY, next)
      setSession(next)
    }
    return {
      user,
      site,
      signIn: (personId) => persist({ personId }),
      signOut: () => persist(null),
    }
  }, [session, state.people, state.sites])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, site } = useAuth()
  const location = useLocation()
  if (!user || !site)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}
