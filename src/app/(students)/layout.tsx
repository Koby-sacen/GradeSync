import type { ReactNode } from 'react'
import StudentSidebar from '@/components/features/students/shared/sideBar'
import { requireRole } from '@/lib/require-role'

interface StudentLayoutProps {
  children: ReactNode
}

export default async function StudentLayout({
  children,
}: StudentLayoutProps) {
  // Verify student access on the server before rendering protected content.

  await requireRole('student')

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      {/* Student Sidebar */}
      <StudentSidebar />

      {/* Main Content Area */}
      <main
        id="student-main-content"
        className="min-w-0 w-full flex-1 overflow-x-hidden bg-slate-50"
      >
        {children}
      </main>
    </div>
  )
}