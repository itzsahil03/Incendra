import { Outlet } from 'react-router-dom'
import { PublicHeader } from './PublicHeader'
import { PublicFooter } from './PublicFooter'

export function PublicShell() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PublicHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
