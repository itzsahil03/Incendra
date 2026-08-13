import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/app/hooks'

export function NotFoundPage() {
  const user = useAppSelector((s) => s.session.user)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 bg-black text-center text-white">
      <p className="font-serif text-4xl font-extrabold">404</p>
      <p className="text-white/70">This page doesn&apos;t exist.</p>
      <Button asChild className="mt-2 rounded-full bg-white font-semibold text-black hover:bg-white/85">
        <Link to={user ? '/app' : '/'}>{user ? 'Back to dashboard' : 'Back home'}</Link>
      </Button>
    </div>
  )
}
