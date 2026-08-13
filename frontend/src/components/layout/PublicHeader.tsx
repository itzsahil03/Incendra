import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAppSelector } from '@/app/hooks'
import { IncendraLogo } from '@/components/common/IncendraLogo'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
]

export function PublicHeader() {
  const user = useAppSelector((s) => s.session.user)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-marketing-border bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center gap-4 px-5">
          <IncendraLogo theme="dark" />
          <div className="flex-1" />

          <nav className="hidden items-center gap-1 rounded-full border border-white/20 p-1.5 lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/8 hover:text-white',
                    isActive && 'bg-white/10 font-semibold text-white',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-1.5 lg:flex">
            {user?.orgId ? (
              <Button asChild className="rounded-full bg-white font-semibold text-black hover:bg-white/85">
                <Link to="/app">Go to Dashboard</Link>
              </Button>
            ) : user ? null : (
              <>
                <Link
                  to="/login"
                  className="rounded-full border border-white/28 px-4.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/12"
                >
                  Log in
                </Link>
                <Button asChild className="rounded-full bg-white font-semibold text-black hover:bg-white/85">
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="flex size-11 items-center justify-center rounded-full border border-white/20 text-white/80 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 border-marketing-border bg-black text-white">
          <SheetHeader>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <IncendraLogo theme="dark" />
          </SheetHeader>
          <Separator className="bg-marketing-border" />
          <nav className="flex flex-1 flex-col gap-1 px-4">
            {NAV_LINKS.map((link) => (
              <SheetClose asChild key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    cn('rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80', isActive && 'text-marketing-accent-soft')
                  }
                >
                  {link.label}
                </NavLink>
              </SheetClose>
            ))}
          </nav>
          <Separator className="bg-marketing-border" />
          <div className="flex flex-col gap-2 p-4">
            {user?.orgId ? (
              <SheetClose asChild>
                <Button asChild className="rounded-full bg-white font-semibold text-black hover:bg-white/85">
                  <Link to="/app">Go to Dashboard</Link>
                </Button>
              </SheetClose>
            ) : user ? null : (
              <>
                <SheetClose asChild>
                  <Button asChild variant="outline" className="rounded-full border-white/28 bg-transparent text-white hover:bg-white/12">
                    <Link to="/login">Log in</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="rounded-full bg-white font-semibold text-black hover:bg-white/85">
                    <Link to="/register">Get Started</Link>
                  </Button>
                </SheetClose>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
