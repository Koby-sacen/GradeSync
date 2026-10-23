
import type { ReactNode } from 'react'
import StudentSidebar from '@/components/features/students/shared/sideBar'
import { requireRole } from '@/lib/require-role'

interface StudentLayoutProps {
  children: ReactNode
}

export default async function StudentLayout({
  children,
}: StudentLayoutProps) {
  // SECURITY:
  // Verify the Firebase session cookie on the server.
  // Only users with the "student" role can access
  // pages inside /students/*.
  //
  // Instructors are redirected to /instructor/home.
  // Unauthenticated users are redirected to /login.
  //
  // Verification happens before the student
  // layout and sidebar are rendered.
  await requireRole('student')

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Student Sidebar */}
      <StudentSidebar />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
