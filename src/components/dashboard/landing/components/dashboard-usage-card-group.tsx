import { Video, Clock, Download, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const cards = [
  {
    title: 'Videos generated',
    icon: <Video className={'text-[#4B4F4F]'} size={18} />,
    value: '0',
    change: 'Start creating your first video',
  },
  {
    title: 'Processing time',
    icon: <Clock className={'text-[#4B4F4F]'} size={18} />,
    value: '0 min',
    change: 'Average generation time',
  },
  {
    title: 'Downloads',
    icon: <Download className={'text-[#4B4F4F]'} size={18} />,
    value: '0',
    change: 'Total video downloads',
  },
  {
    title: 'Trending topics',
    icon: <TrendingUp className={'text-[#4B4F4F]'} size={18} />,
    value: '0',
    change: 'Topics explored',
  },
];
export function DashboardUsageCardGroup() {
  return (
    <div className={'grid gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2'}>
      {cards.map((card) => (
        <Card key={card.title} className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
          <CardHeader className="p-0 space-y-0">
            <CardTitle className="flex justify-between items-center mb-6">
              <span className={'text-base leading-4'}>{card.title}</span> {card.icon}
            </CardTitle>
            <CardDescription className={'text-[32px] leading-[32px] text-primary'}>{card.value}</CardDescription>
          </CardHeader>
          <CardContent className={'p-0'}>
            <div className="text-sm leading-[14px] pt-2 text-secondary">{card.change}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
