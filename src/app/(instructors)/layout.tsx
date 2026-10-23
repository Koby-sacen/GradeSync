
import type { ReactNode } from 'react'
import Sidebar from '@/components/features/instructors/shared/sideBar'
import { requireRole } from '@/lib/require-role'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  // SECURITY:
  // Verify the Firebase session cookie on the server.
  // Only users with the "instructor" role can access
  // pages inside /instructor/*.
  //
  // Students are redirected to /students/home.
  // Unauthenticated users are redirected to /login.
  //
  // Verification happens before the dashboard
  // layout and sidebar are rendered.
  await requireRole('instructor')

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#edf4f8] font-sans text-slate-800">
      <Sidebar />

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
