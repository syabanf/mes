import { type Permission, can } from '@mes/fixtures'
import type { Person, Site } from '@mes/types'
import { type ReactNode, createContext, useContext, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { readStorage, writeStorage } from '../lib/storage'
import { useStore } from '../state/store'

const SESSION_KEY = 'mes.admin.session'

interface Session {
  personId: string
  siteId: string
}

interface AuthValue {
  user: Person | null
  site: Site | null
  sites: Site[]
  signIn: (personId: string) => void
  signOut: () => void
  switchSite: (siteId: string) => void
  stationOperatorId: string | null
  setStationOperatorId: (id: string | null) => void
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state } = useStore()
  const [session, setSession] = useState<Session | null>(() => readStorage<Session | null>(SESSION_KEY, null))
  // Station identification belongs to this app session, not a browser preference.
  const [stationOperatorId, setStationOperatorId] = useState<string | null>(null)

  const value = useMemo<AuthValue>(() => {
    const user = session ? (state.people.find((p) => p.id === session.personId) ?? null) : null
    const sites = user ? state.sites.filter((s) => user.siteIds.includes(s.id)) : []
    const site = user ? (sites.find((s) => s.id === session?.siteId) ?? sites[0] ?? null) : null
    const persist = (next: Session | null) => {
      if (next?.personId !== session?.personId || next?.siteId !== session?.siteId) setStationOperatorId(null)
      writeStorage(SESSION_KEY, next)
      setSession(next)
    }
    return {
      user,
      site,
      sites,
      stationOperatorId,
      setStationOperatorId,
      signIn: (personId) => {
        const person = state.people.find((p) => p.id === personId)
        if (person) persist({ personId, siteId: person.siteIds[0]! })
      },
      signOut: () => persist(null),
      switchSite: (siteId) => session && persist({ ...session, siteId }),
      can: (permission) => !!user && can(user.role, permission),
    }
  }, [session, stationOperatorId, state.people, state.sites])

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
  if (!user || !site) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
