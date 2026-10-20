import Sidebar from '@/components/features/instructors/shared/sideBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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