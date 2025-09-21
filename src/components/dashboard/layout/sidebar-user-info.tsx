'use client';

import { Separator } from '@/components/ui/separator';
import { LogOut, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { MouseEvent, useState } from 'react';
import { useUserInfo } from '@/hooks/useUserInfo';
import { Button } from '@/components/ui/button';

export function SidebarUserInfo() {
  const supabase = createClient();
  const { user } = useUserInfo(supabase);
  const [showNotification, setShowNotification] = useState(true);

  async function handleLogout(e: MouseEvent) {
    e.preventDefault();
    await supabase.auth.signOut();
    location.reload();
  }

  const handleDismissNotification = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowNotification(false);
  };

  return (
    <div className={'flex flex-col items-start pb-8 px-2 text-sm font-medium lg:px-4 w-full'}>
      <Separator className={'relative mt-6 dashboard-sidebar-highlight bg-[#283031]'} />
      
      {/* Notification Badge */}
      {showNotification && (
        <div className={'flex w-full flex-row mt-4 items-center justify-between bg-red-600 text-white px-3 py-2 rounded-md'}>
          <div className={'flex items-center gap-2'}>
            <span className={'text-xs font-medium'}>1 Issue</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissNotification}
            className={'h-6 w-6 p-0 text-white hover:bg-red-700'}
          >
            <X className={'h-3 w-3'} />
          </Button>
        </div>
      )}

      {/* User Info */}
      <div className={'flex w-full flex-row mt-6 items-center justify-between'}>
        <div className={'flex flex-col items-start justify-center overflow-hidden text-ellipsis flex-1'}>
          <div className={'text-sm leading-5 font-semibold w-full overflow-hidden text-ellipsis text-white'}>
            {user?.user_metadata?.full_name || 'User'}
          </div>
          <div className={'text-xs leading-4 text-muted-foreground w-full overflow-hidden text-ellipsis'}>
            {user?.email}
          </div>
        </div>
        <div className={'flex items-center gap-2'}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={'h-8 w-8 p-0 text-muted-foreground hover:text-white hover:bg-gray-700'}
          >
            <LogOut className={'h-4 w-4'} />
          </Button>
        </div>
      </div>
    </div>
  );
}
