import { newId } from '@mes/fixtures'
import type { OrgNode, Site } from '@mes/types'
import { ORG_KINDS, ORG_KIND_LABEL } from '@mes/types'
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  ConfirmDialog,
  EmptyState,
  UnderlineTabs,
  cn,
  toast,
} from '@mes/ui'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono } from './entity'
import { childKind, usePanelTab } from './lib'

const TABS = [
  { value: 'sites', label: 'Sites' },
  { value: 'hierarchy', label: 'Org hierarchy' },
] as const

export function OrganizationPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {tab === 'sites' ? <SitesTable /> : <HierarchyTree />}
    </div>
  )
}

function SitesTable() {
  const s = useScoped()
  const columns: Column<Site>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className={cn('font-semibold', x.id === s.siteId && 'text-accent')}>{x.name}</span>,
    },
    { id: 'city', header: 'City', hideBelow: 'sm', cell: (x) => x.city },
    { id: 'tz', header: 'Timezone', hideBelow: 'md', cell: (x) => <Mono>{x.timezone}</Mono> },
  ]
  return (
    <EntityTable
      title="Sites"
      description="Sites come from the company setup and are read-only here. The highlighted one is your current site."
      rows={s.state.sites}
      columns={columns}
      search={(x) => `${x.code} ${x.name} ${x.city}`}
      canManage={false}
    />
  )
}

type Editor = { open: boolean; item: OrgNode | null; parent: OrgNode | null }

function HierarchyTree() {
  const s = useScoped()
  const { can } = useAuth()
  const manage = can('masterdata.manage')
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(s.orgNodes.filter((n) => n.kind === 'plant' || n.kind === 'area').map((n) => n.id)),
  )
  const [editor, setEditor] = useState<Editor>({ open: false, item: null, parent: null })
  const [removing, setRemoving] = useState<OrgNode | null>(null)

  const children = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>()
    for (const n of [...s.orgNodes].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    ))
      map.set(n.parentId, [...(map.get(n.parentId) ?? []), n])
    return map
  }, [s.orgNodes])
  const roots = children.get(null) ?? []
  const toggle = (id: string) =>
    setExpanded((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const fields: Field<OrgNode>[] = [
    {
      key: 'kind',
      label: 'Kind',
      kind: 'select',
      required: true,
      options: ORG_KINDS.map((k) => ({ value: k, label: ORG_KIND_LABEL[k] })),
    },
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true, span: 2 },
    {
      key: 'capacityHoursPerShift',
      label: 'Capacity hours per shift',
      kind: 'number',
      min: 0,
      hint: 'Work centers only. Leave empty to derive capacity from the shift length.',
    },
  ]

  const renderNode = (node: OrgNode, depth: number) => {
    const kids = children.get(node.id) ?? []
    const open = expanded.has(node.id)
    const next = childKind(node.kind)
    return (
      <div key={node.id}>
        <div
          className="group gap-2 rounded-2xl px-2 py-1.5 flex items-center hover:bg-surface-2"
          style={{ paddingLeft: depth * 20 + 8 }}
        >
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            disabled={kids.length === 0}
            onClick={() => toggle(node.id)}
            className="size-6 [&_svg]:size-4 flex shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface disabled:opacity-30"
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </button>
          <Badge variant={node.kind === 'work_center' ? 'ink' : 'outline'}>{ORG_KIND_LABEL[node.kind]}</Badge>
          <span className="min-w-0 text-sm flex-1 truncate">
            <span className="font-semibold">{node.name}</span> <Mono>{node.code}</Mono>
            {node.kind === 'work_center' && (
              <span className="ml-2 text-xs text-muted">
                {node.capacityHoursPerShift
                  ? `${node.capacityHoursPerShift} h / shift`
                  : 'capacity from shifts'}
              </span>
            )}
          </span>
          {manage && (
            <span className="gap-1 flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {next && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditor({ open: true, item: null, parent: node })}
                >
                  <Plus />
                  Add {ORG_KIND_LABEL[next].toLowerCase()}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit"
                onClick={() =>
                  setEditor({
                    open: true,
                    item: node,
                    parent: node.parentId ? (s.maps.orgNode.get(node.parentId) ?? null) : null,
                  })
                }
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove"
                disabled={kids.length > 0}
                title={kids.length ? 'Remove the children first' : 'Remove'}
                onClick={() => setRemoving(node)}
              >
                <Trash2 />
              </Button>
            </span>
          )}
        </div>
        {open && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader
        action={
          manage && (
            <Button onClick={() => setEditor({ open: true, item: null, parent: null })}>
              <Plus />
              Add plant
            </Button>
          )
        }
      >
        <CardTitle>Org hierarchy</CardTitle>
        <CardDescription>
          Plant → area → line → work center → production zone for {s.site.name}. Work centers carry the
          capacity used by planning.
        </CardDescription>
      </CardHeader>
      <div className="px-3 pb-4">
        {roots.length === 0 ? (
          <EmptyState
            compact
            title="No hierarchy yet"
            description="Add a plant to start modelling the site."
          />
        ) : (
          roots.map((r) => renderNode(r, 0))
        )}
      </div>
      <EntityDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        title={
          editor.item
            ? `Edit ${editor.item.name}`
            : editor.parent
              ? `New node under ${editor.parent.name}`
              : 'New plant'
        }
        description={editor.parent ? `Parent: ${s.orgPath(editor.parent.id)}` : undefined}
        fields={fields}
        item={editor.item}
        blank={(): OrgNode => ({
          id: newId('org'),
          siteId: s.siteId,
          parentId: editor.parent?.id ?? null,
          kind: childKind(editor.parent?.kind ?? null) ?? 'zone',
          code: '',
          name: '',
        })}
        existing={s.orgNodes}
        onSave={(item) =>
          s.dispatch({
            type: 'orgNodes/upsert',
            item: item.kind === 'work_center' ? item : { ...item, capacityHoursPerShift: undefined },
          })
        }
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Remove ${removing.name}?` : ''}
        description="Machines and work orders that point at this node keep the id but lose the name."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removing) s.dispatch({ type: 'orgNodes/remove', id: removing.id })
          setRemoving(null)
          toast('Node removed', { tone: 'default' })
        }}
      />
    </Card>
  )
}
