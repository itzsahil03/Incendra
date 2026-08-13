import { Link } from 'react-router-dom'
import { IncendraLogo } from '@/components/common/IncendraLogo'
import { Separator } from '@/components/ui/separator'

const COLUMNS: { heading: string; links: { label: string; to: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Services', to: '/services' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Contact Us', to: '/contact' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Create account', to: '/register' },
    ],
  },
]

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-marketing-border bg-black">
      <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row sm:gap-8">
          <div className="flex max-w-[300px] flex-col gap-3">
            <IncendraLogo theme="dark" />
            <p className="text-sm text-white/65">
              The command center for incident response — from first alert to resolution, all in one place.
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:gap-14">
            {COLUMNS.map((col) => (
              <div key={col.heading} className="flex flex-col gap-2.5">
                <p className="text-sm font-bold text-white">{col.heading}</p>
                {col.links.map((link) => (
                  <Link key={link.to} to={link.to} className="text-sm text-white/65 hover:text-marketing-accent-soft">
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-9 bg-marketing-border" />

        <div className="flex flex-col justify-between gap-1.5 sm:flex-row sm:items-center">
          <p className="text-xs text-white/55">© {new Date().getFullYear()} Incendra. All systems monitored.</p>
          <p className="text-xs text-white/55">Built for fast, coordinated incident response.</p>
        </div>
      </div>
    </footer>
  )
}
