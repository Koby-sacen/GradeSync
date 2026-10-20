import React from 'react'
import StudentSidebar from '@/components/features/students/shared/sideBar' // Adjust the import path if your sidebar is located elsewhere

interface StudentLayoutProps {
  children: React.ReactNode
}

export default function StudentLayout({ children }: StudentLayoutProps) {
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