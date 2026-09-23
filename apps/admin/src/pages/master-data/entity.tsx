import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  type Column,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  MultiCombobox,
  NativeSelect,
  Switch,
  cn,
  toast,
} from '@mes/ui'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'

// ─── Field configuration ────────────────────────────────────────

export type Option = { value: string; label: string }
export type PickItem = { id: string; label: string; description?: string }

type Base<T> = {
  key: Extract<keyof T, string>
  label: string
  hint?: string
  required?: boolean
  span?: 1 | 2
}

export type Field<T> =
  | (Base<T> & { kind: 'text'; mono?: boolean; readOnly?: boolean; placeholder?: string })
  | (Base<T> & { kind: 'number'; min?: number; step?: number })
  | (Base<T> & { kind: 'select'; options: Option[] })
  | (Base<T> & { kind: 'combobox'; items: PickItem[]; clearable?: boolean })
  | (Base<T> & { kind: 'multi'; items: PickItem[] })
  | (Base<T> & { kind: 'switch' })
  | (Base<T> & { kind: 'custom'; render: (draft: T, set: (patch: Partial<T>) => void) => ReactNode })

type Rec = Record<string, unknown>
const read = <T,>(draft: T, key: string) => (draft as Rec)[key]

const isEmpty = (v: unknown) =>
  v === null ||
  v === undefined ||
  (typeof v === 'string' && v.trim() === '') ||
  (typeof v === 'number' && !Number.isFinite(v)) ||
  (Array.isArray(v) && v.length === 0)

// ─── Editor state ───────────────────────────────────────────────

/** Open/closed state of one entity dialog: `item` is null for a new record. */
export function useEditor<T>() {
  const [state, setState] = useState<{ open: boolean; item: T | null }>({ open: false, item: null })
  return {
    open: state.open,
    item: state.item,
    create: () => setState({ open: true, item: null }),
    edit: (item: T) => setState({ open: true, item }),
    setOpen: (open: boolean) => setState((s) => ({ ...s, open })),
  }
}

// ─── Dialog ─────────────────────────────────────────────────────

export interface EntityDialogProps<T extends { id: string }> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: Field<T>[]
  /** Record being edited, or null for a new one. */
  item: T | null
  /** Fresh record for the create case, ids included. */
  blank: () => NoInfer<T>
  existing: readonly T[]
  /** Keys that must be unique across `existing`; `code` when present is always checked. */
  uniqueKeys?: Extract<keyof T, string>[]
  validate?: (draft: T) => Partial<Record<Extract<keyof T, string>, string>>
  onSave: (item: T) => void
  size?: 'sm' | 'md' | 'lg'
}

export function EntityDialog<T extends { id: string }>(props: EntityDialogProps<T>) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size={props.size ?? 'md'}>{props.open && <EntityForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function EntityForm<T extends { id: string }>({
  title,
  description,
  fields,
  item,
  blank,
  existing,
  uniqueKeys = [],
  validate,
  onSave,
  onOpenChange,
}: EntityDialogProps<T>) {
  const [draft, setDraft] = useState<T>(() => item ?? blank())
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<T>) => setDraft((d) => ({ ...d, ...patch }))
  const setKey = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }))

  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of fields) {
      if (f.required && isEmpty(read(draft, f.key))) out[f.key] = `${f.label} is required.`
    }
    const keys = new Set<string>(uniqueKeys)
    if ('code' in (draft as Rec)) keys.add('code')
    for (const key of keys) {
      const value = read(draft, key)
      if (isEmpty(value)) continue
      const clash = existing.some(
        (x) => x.id !== draft.id && String(read(x, key)).toLowerCase() === String(value).toLowerCase(),
      )
      if (clash) out[key] = `Another record already uses this ${key}.`
    }
    const merged: Record<string, string> = { ...out, ...(validate?.(draft) ?? {}) }
    return merged
  }, [draft, fields, existing, uniqueKeys, validate])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    const clean = { ...draft } as Rec
    for (const f of fields) {
      if (f.kind === 'number' && !Number.isFinite(clean[f.key] as number)) clean[f.key] = 0
      if (f.kind === 'text' && typeof clean[f.key] === 'string')
        clean[f.key] = (clean[f.key] as string).trim()
    }
    onSave(clean as T)
    onOpenChange(false)
    toast(item ? 'Changes saved' : 'Record created', { tone: 'success' })
  }

  const error = (key: string) => (tried ? errors[key] : undefined)

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        {fields.map((f) => {
          const value = read(draft, f.key)
          const wrap = cn(f.span === 2 && 'sm:col-span-2')
          switch (f.kind) {
            case 'text':
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={error(f.key)}
                  required={f.required}
                  className={wrap}
                >
                  <Input
                    value={String(value ?? '')}
                    readOnly={f.readOnly}
                    placeholder={f.placeholder}
                    onChange={(e) => setKey(f.key, e.target.value)}
                    inputClassName={cn(f.mono && 'font-mono text-xs', f.readOnly && 'bg-surface')}
                  />
                </FormField>
              )
            case 'number':
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={error(f.key)}
                  required={f.required}
                  className={wrap}
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={f.min}
                    step={f.step ?? 'any'}
                    value={typeof value === 'number' && Number.isFinite(value) ? String(value) : ''}
                    onChange={(e) =>
                      setKey(f.key, e.target.value === '' ? Number.NaN : Number(e.target.value))
                    }
                  />
                </FormField>
              )
            case 'select':
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={error(f.key)}
                  required={f.required}
                  className={wrap}
                >
                  <NativeSelect
                    options={f.options}
                    placeholder="Select"
                    value={String(value ?? '')}
                    onChange={(e) => setKey(f.key, e.target.value)}
                  />
                </FormField>
              )
            case 'combobox':
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={error(f.key)}
                  required={f.required}
                  className={wrap}
                >
                  <Combobox
                    items={f.items}
                    getKey={(x) => x.id}
                    getLabel={(x) => x.label}
                    getDescription={(x) => x.description}
                    value={(value as string | null) ?? null}
                    clearable={f.clearable}
                    onChange={(v) => setKey(f.key, v)}
                    placeholder={`Select ${f.label.toLowerCase()}`}
                    searchPlaceholder="Search"
                  />
                </FormField>
              )
            case 'multi':
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={error(f.key)}
                  required={f.required}
                  className={wrap}
                >
                  <MultiCombobox
                    items={f.items}
                    getKey={(x) => x.id}
                    getLabel={(x) => x.label}
                    getDescription={(x) => x.description}
                    values={(value as string[] | undefined) ?? []}
                    onChange={(v) => setKey(f.key, v)}
                    placeholder={`Select ${f.label.toLowerCase()}`}
                    searchPlaceholder="Search"
                  />
                </FormField>
              )
            case 'switch':
              return (
                <FormField key={f.key} label={f.label} hint={f.hint} className={wrap}>
                  <div className="h-11 flex items-center">
                    <Switch
                      checked={!!value}
                      onCheckedChange={(v) => setKey(f.key, v)}
                      aria-label={f.label}
                    />
                  </div>
                </FormField>
              )
            case 'custom':
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={error(f.key)}
                  required={f.required}
                  className={wrap}
                >
                  {f.render(draft, set)}
                </FormField>
              )
          }
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit">{item ? 'Save changes' : 'Create'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Table ──────────────────────────────────────────────────────

export interface EntityTableProps<T extends { id: string }> {
  title: string
  description?: string
  rows: readonly T[]
  columns: Column<T>[]
  /** Text searched by the box in the header. */
  search: (row: T) => string
  canManage: boolean
  onAdd?: () => void
  onEdit?: (row: T) => void
  onRemove?: (row: T) => void
  /** Null blocks the delete with the given reason. */
  removeBlocker?: (row: T) => string | null
  removeLabel?: (row: T) => string
  addLabel?: string
  empty?: string
  extra?: ReactNode
  pageSize?: number
  initialSort?: { id: string; desc?: boolean }
}

/** Card with a search box, an Add button, the table and edit/remove row actions. */
export function EntityTable<T extends { id: string }>({
  title,
  description,
  rows,
  columns,
  search,
  canManage,
  onAdd,
  onEdit,
  onRemove,
  removeBlocker,
  removeLabel,
  addLabel = 'Add',
  empty = 'No records yet.',
  extra,
  pageSize,
  initialSort,
}: EntityTableProps<T>) {
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState<T | null>(null)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => search(r).toLowerCase().includes(q)) : [...rows]
  }, [rows, query, search])

  const actionColumn: Column<T> | null =
    canManage && (onEdit || onRemove)
      ? {
          id: '_actions',
          header: <span className="sr-only">Actions</span>,
          align: 'right',
          width: '5.5rem',
          cell: (row) => {
            const blocked = removeBlocker?.(row) ?? null
            return (
              <span className="gap-1 inline-flex">
                {onEdit && (
                  <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => onEdit(row)}>
                    <Pencil />
                  </Button>
                )}
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    title={blocked ?? 'Remove'}
                    disabled={!!blocked}
                    onClick={() => setRemoving(row)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </span>
            )
          },
        }
      : null

  return (
    <Card>
      <CardHeader
        action={
          <>
            <Input
              variant="pill"
              aria-label={`Search ${title.toLowerCase()}`}
              leftIcon={<Search />}
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-56 w-full"
            />
            {extra}
            {canManage && onAdd && (
              <Button onClick={onAdd}>
                <Plus />
                {addLabel}
              </Button>
            )}
          </>
        }
      >
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <DataTable
        columns={actionColumn ? [...columns, actionColumn] : columns}
        rows={filtered}
        getRowKey={(r) => r.id}
        onRowClick={canManage && onEdit ? onEdit : undefined}
        resetPageKey={query}
        pageSize={pageSize}
        initialSort={initialSort}
        empty={
          <EmptyState
            compact
            title={query ? 'No matches' : empty}
            description={
              query
                ? 'Try another search term.'
                : canManage && onAdd
                  ? `Use ${addLabel} to create the first one.`
                  : undefined
            }
          />
        }
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Remove ${removeLabel?.(removing) ?? 'this record'}?` : ''}
        description="Records that reference it keep their id, so remove only what nothing uses."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removing) onRemove?.(removing)
          setRemoving(null)
          toast('Record removed', { tone: 'default' })
        }}
      />
    </Card>
  )
}

export const Mono = ({ children }: { children: ReactNode }) => (
  <span className="text-xs font-mono">{children}</span>
)
export const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted">{children}</span>
export const YesNo = ({ value }: { value: boolean }) => (
  <span className={value ? '' : 'text-muted'}>{value ? 'Yes' : 'No'}</span>
)
