import Link from 'next/link';
import Image from 'next/image';
import { ReactNode } from 'react';
import { DashboardGradient } from '@/components/gradients/dashboard-gradient';
import '../../../styles/dashboard.css';
import { Sidebar } from '@/components/dashboard/layout/sidebar';
import { SidebarUserInfo } from '@/components/dashboard/layout/sidebar-user-info';

interface Props {
  children: ReactNode;
}

export function DashboardLayout({ children }: Props) {
  return (
    <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] relative overflow-hidden">
      <DashboardGradient />
      <div className="hidden border-r md:block relative">
        <div className="flex h-full flex-col">
          <div className="flex items-center pt-8 pl-6 pb-10 flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Image src={'/assets/icons/logo/aeroedit-logo-icon.svg'} alt={'AeroEdit'} width={41} height={41} />
            </Link>
          </div>
          <div className="flex flex-col flex-1 min-h-0">
            <Sidebar />
          </div>
          <div className="mt-auto flex-shrink-0">
            <SidebarUserInfo />
          </div>
        </div>
      </div>
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
