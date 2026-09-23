import { toast } from '@mes/ui'
import { type ReactNode, createContext, useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from './links'
import { type MoPreset, ManufacturingOrderDialog } from './ManufacturingOrderDialog'
import { MarketingOrderDialog } from './MarketingOrderDialog'

interface CreateApi {
  marketingOrder: () => void
  /** Open the manufacturing order form, optionally pre-filled from a demand or replenishment. */
  manufacturingOrder: (preset?: MoPreset) => void
}

const CreateContext = createContext<CreateApi | null>(null)

/** Hosts the create dialogs so any page, menu or shortcut can open them. */
export function CreateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [mkt, setMkt] = useState(false)
  const [mo, setMo] = useState<{ open: boolean; preset?: MoPreset }>({ open: false })

  const api = useMemo<CreateApi>(
    () => ({
      marketingOrder: () => setMkt(true),
      manufacturingOrder: (preset) => setMo({ open: true, preset }),
    }),
    [],
  )

  return (
    <CreateContext.Provider value={api}>
      {children}
      <MarketingOrderDialog
        open={mkt}
        onOpenChange={setMkt}
        onSaved={(saved) => {
          toast('Marketing order created', { tone: 'success', description: 'Confirm it to raise demand.' })
          navigate(paths.marketingOrder(saved.id))
        }}
      />
      <ManufacturingOrderDialog
        open={mo.open}
        onOpenChange={(open) => setMo((s) => ({ ...s, open }))}
        preset={mo.preset}
        onSaved={(saved) => {
          toast('Manufacturing order created', {
            tone: 'success',
            description: 'Plan and release it to generate work orders.',
          })
          navigate(paths.mo(saved.id))
        }}
      />
    </CreateContext.Provider>
  )
}

export function useCreate() {
  const ctx = useContext(CreateContext)
  if (!ctx) throw new Error('useCreate must be used inside CreateProvider')
  return ctx
}
