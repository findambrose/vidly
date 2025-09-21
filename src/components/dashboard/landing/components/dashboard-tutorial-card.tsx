import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, Video, TrendingUp, Lightbulb } from 'lucide-react';
import Link from 'next/link';

const quickActions = [
  {
    title: 'Create Video',
    description: 'Generate your first TikTok video',
    icon: <Video className="h-4 w-4" />,
    href: '/create',
  },
  {
    title: 'View Videos',
    description: 'Manage your video library',
    icon: <TrendingUp className="h-4 w-4" />,
    href: '/videos',
  }
];

export function DashboardTutorialCard() {
  return (
    <Card className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
      <CardHeader className="p-0 space-y-0">
        <CardTitle className="flex justify-between items-center text-xl mb-2 font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className={'p-0 flex flex-col gap-4'}>
        <div className="text-base leading-6 text-secondary">
          Jump into creating amazing TikTok videos with trending topics and AI-powered generation.
        </div>
        <div className="space-y-3">
          {quickActions.map((action) => (
            <Button 
              key={action.title}
              asChild
              size={'sm'} 
              variant={'outline'} 
              className={'w-full justify-start gap-3 text-sm rounded-sm border-border h-auto py-3 px-4'}
            >
              <Link href={action.href}>
                {action.icon}
                <div className="flex flex-col items-start">
                  <span className="font-medium">{action.title}</span>
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                </div>
                <ArrowUpRight size={16} className={'text-[#797C7C] ml-auto'} />
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
