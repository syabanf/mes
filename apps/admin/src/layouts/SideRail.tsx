import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Rail,
  RailAction,
  RailCollapse,
  RailItem,
  RailWorkspace,
  cn,
} from '@mes/ui'
import { Building, Check, ChevronDown, LogOut, Plus } from 'lucide-react'
import { Fragment } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../auth/auth'
import { CreateMenu } from './CreateMenu'
import { LogoMark } from './LogoMark'
import { NAV, leafFor, sectionFor } from './nav'
import { useNavCounts } from './useNavCounts'

export function SideRail({
  expanded,
  canExpand,
  onToggle,
}: {
  expanded: boolean
  canExpand: boolean
  onToggle: () => void
}) {
  const { pathname } = useLocation()
  const counts = useNavCounts()
  const current = sectionFor(pathname)
  const leaf = leafFor(pathname)

  return (
    <Rail
      expanded={expanded}
      header={
        <Link
          to="/"
          className={cn('gap-3 rounded-2xl flex items-center', expanded && 'px-1 w-full')}
          aria-label="Dashboard"
        >
          <span className="size-11 rounded-2xl bg-white/5 flex shrink-0 items-center justify-center">
            <LogoMark className="size-7" />
          </span>
          {expanded && (
            <span className="min-w-0">
              <span className="font-bold leading-tight tracking-tight block text-[15px]">MES</span>
              <span className="block text-[11px] text-on-ink-muted">Manufacturing Ops</span>
            </span>
          )}
        </Link>
      }
      action={
        <CreateMenu
          side="right"
          align="start"
          trigger={
            <RailAction label="Create" expanded={expanded}>
              <Plus />
            </RailAction>
          }
        />
      }
      workspace={<WorkspaceMenu expanded={expanded} />}
      footer={canExpand ? <RailCollapse expanded={expanded} onToggle={onToggle} /> : undefined}
    >
      {NAV.map((section) => {
        const Icon = section.icon
        const isCurrent = section.id === current.id
        const open = expanded && isCurrent && !!section.items
        const badge =
          section.items?.reduce((sum, item) => sum + (item.badge ? counts[item.badge] : 0), 0) ?? 0
        return (
          <Fragment key={section.id}>
            <RailItem
              asChild
              expanded={expanded}
              active={isCurrent && !open}
              icon={<Icon />}
              label={section.label}
              badge={open ? 0 : badge}
              className={open ? 'text-white' : undefined}
              trailing={
                expanded && section.items ? (
                  <ChevronDown className={cn('!size-4 transition-transform', open && 'rotate-180')} />
                ) : undefined
              }
            >
              <NavLink to={section.to} end={section.to === '/'} />
            </RailItem>
            {open &&
              section.items!.map((item) => (
                <RailItem
                  key={item.to}
                  asChild
                  sub
                  expanded
                  active={leaf?.to === item.to}
                  label={item.label}
                  badge={item.badge ? counts[item.badge] : 0}
                >
                  <NavLink to={item.to} />
                </RailItem>
              ))}
          </Fragment>
        )
      })}
    </Rail>
  )
}

function WorkspaceMenu({ expanded }: { expanded: boolean }) {
  const { site, sites, switchSite, signOut } = useAuth()
  if (!site) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RailWorkspace
          icon={<Building />}
          kicker="Site"
          name={site.name}
          expanded={expanded}
          aria-label={`Site: ${site.name}`}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={expanded ? 'top' : 'right'}
        align={expanded ? 'start' : 'end'}
        className="w-64"
      >
        <DropdownMenuLabel>Switch site</DropdownMenuLabel>
        {sites.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => switchSite(s.id)}>
            <Building />
            <span className="flex-1">
              {s.name}
              <span className="text-xs block text-muted">{s.city}</span>
            </span>
            {s.id === site.id && <Check className="text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
