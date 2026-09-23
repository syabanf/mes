import { MO_ORDER_STATUS_LABEL, MO_STATUS_LABEL, WO_STATUS_LABEL } from '@mes/types'
import { Input, cn } from '@mes/ui'
import { Search } from 'lucide-react'
import { type KeyboardEvent, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../components/links'
import { type Scoped, useScoped } from '../state/scoped'

interface Hit {
  id: string
  label: string
  hint: string
  to: string
}

const LIMIT = 5

function searchAll(s: Scoped, query: string): { group: string; hits: Hit[] }[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const match = (...fields: (string | undefined | null)[]) => {
    const text = fields.join(' ').toLowerCase()
    return terms.every((t) => text.includes(t))
  }
  const groups = [
    {
      group: 'Manufacturing orders',
      hits: [...s.manufacturingOrders]
        .reverse()
        .filter((m) => match(m.code, s.productName(m.productId), s.productCode(m.productId)))
        .map((m) => ({
          id: m.id,
          label: `${m.code} · ${s.productName(m.productId)}`,
          hint: `${MO_STATUS_LABEL[m.status]} · ${m.qty} ${s.uomCode(m.uomId)}`,
          to: paths.mo(m.id),
        })),
    },
    {
      group: 'Work orders',
      hits: [...s.workOrders]
        .reverse()
        .filter((w) => match(w.code, w.operationName, s.maps.machine.get(w.machineId ?? '')?.code))
        .map((w) => ({
          id: w.id,
          label: `${w.code} · ${w.operationName}`,
          hint: `${WO_STATUS_LABEL[w.status]} · ${s.orgName(w.workCenterId)}`,
          to: paths.wo(w.id),
        })),
    },
    {
      group: 'Marketing orders',
      hits: [...s.marketingOrders]
        .reverse()
        .filter((o) => match(o.code, o.reference, s.maps.customer.get(o.customerId)?.name))
        .map((o) => ({
          id: o.id,
          label: `${o.code} · ${s.maps.customer.get(o.customerId)?.name ?? ''}`,
          hint: MO_ORDER_STATUS_LABEL[o.status],
          to: paths.marketingOrder(o.id),
        })),
    },
    {
      group: 'Products',
      hits: s.products
        .filter((p) => match(p.code, p.name))
        .map((p) => ({
          id: p.id,
          label: `${p.code} · ${p.name}`,
          hint: `${p.unitWeightG} g`,
          to: paths.product(p.id),
        })),
    },
    {
      group: 'Material lots',
      hits: s.materialLots
        .filter((l) => match(l.code, s.materialName(l.materialId)))
        .map((l) => ({
          id: l.id,
          label: `${l.code} · ${s.materialName(l.materialId)}`,
          hint: `${l.qty} ${s.uomCode(l.uomId)} · ${l.status}`,
          to: paths.lot(l.id),
        })),
    },
    {
      group: 'Machines',
      hits: s.machines
        .filter((m) => match(m.code, m.name, m.id))
        .map((m) => ({
          id: m.id,
          label: `${m.code} · ${m.name}`,
          hint: `${m.id} · ${m.state}`,
          to: paths.machine(m.id),
        })),
    },
    {
      group: 'People',
      hits: s.people
        .filter((p) => match(p.name, p.code, p.role))
        .map((p) => ({ id: p.id, label: p.name, hint: p.role.replace('_', ' '), to: '/master-data/people' })),
    },
  ]
  return groups.map((g) => ({ ...g, hits: g.hits.slice(0, LIMIT) })).filter((g) => g.hits.length)
}

export function GlobalSearch({
  className,
  autoFocus,
  onNavigate,
}: {
  className?: string
  autoFocus?: boolean
  onNavigate?: () => void
}) {
  const scoped = useScoped()
  const navigate = useNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const groups = useMemo(() => searchAll(scoped, query), [scoped, query])
  const flat = groups.flatMap((g) => g.hits)
  const showPanel = focused && query.trim().length > 0

  const go = (hit: Hit) => {
    navigate(hit.to)
    setQuery('')
    setFocused(false)
    onNavigate?.()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      go(flat[active])
    } else if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }

  let index = -1
  return (
    <div className={cn('relative', className)}>
      <Input
        variant="pill"
        type="search"
        leftIcon={<Search />}
        placeholder="Search orders, work orders, lots, machines"
        value={query}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && flat[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="inset-x-0 mt-2 rounded-2xl p-1 absolute top-full z-40 max-h-[60dvh] overflow-y-auto border border-border bg-card shadow-float"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-sm text-center text-muted">No matches for "{query.trim()}"</p>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="py-1">
                <p className="px-3 pb-1 pt-2 font-semibold tracking-wider text-[11px] text-muted uppercase">
                  {g.group}
                </p>
                {g.hits.map((hit) => {
                  index++
                  const i = index
                  return (
                    <button
                      key={hit.id}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit)}
                      className="rounded-xl px-3 py-2 flex w-full flex-col items-start text-left hover:bg-surface aria-selected:bg-surface"
                    >
                      <span className="text-sm font-medium w-full truncate">{hit.label}</span>
                      {hit.hint && <span className="text-xs w-full truncate text-muted">{hit.hint}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
