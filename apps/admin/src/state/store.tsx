import { type AppState, type Envelope, loadLocalState, reduce, saveLocalState } from '@mes/fixtures'
import {
  type Dispatch,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'

const StoreContext = createContext<{
  state: AppState
  send: Dispatch<Envelope>
  storageError: boolean
} | null>(null)

const STORAGE_KEY = 'mes.admin.state.v1'

/** Holds the platform dataset in one reducer and keeps demo changes across reloads. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, send] = useReducer(reduce, undefined, () => loadLocalState(STORAGE_KEY))
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    setStorageError(!saveLocalState(STORAGE_KEY, state))
  }, [state])
  const value = useMemo(() => ({ state, send, storageError }), [state, storageError])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside AppStateProvider')
  return ctx
}
