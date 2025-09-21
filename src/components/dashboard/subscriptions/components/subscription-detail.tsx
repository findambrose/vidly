'use client';

import { getSubscription } from '@/utils/paddle/get-subscription';
import { getTransactions } from '@/utils/paddle/get-transactions';
import { SubscriptionPastPaymentsCard } from '@/components/dashboard/subscriptions/components/subscription-past-payments-card';
import { SubscriptionNextPaymentCard } from '@/components/dashboard/subscriptions/components/subscription-next-payment-card';
import { SubscriptionLineItems } from '@/components/dashboard/subscriptions/components/subscription-line-items';
import { SubscriptionHeader } from '@/components/dashboard/subscriptions/components/subscription-header';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentsContent } from '@/components/dashboard/payments/payments-content';
import { ErrorContent } from '@/components/dashboard/layout/error-content';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/dashboard/layout/loading-screen';
import { SubscriptionDetailResponse, TransactionResponse } from '@/lib/api.types';
import { CreditCard, FileText } from 'lucide-react';

interface Props {
  subscriptionId: string;
}

export function SubscriptionDetail({ subscriptionId }: Props) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [subscription, setSubscription] = useState<SubscriptionDetailResponse>();
  const [transactions, setTransactions] = useState<TransactionResponse>();

  useEffect(() => {
    (async () => {
      const [subscriptionResponse, transactionsResponse] = await Promise.all([
        getSubscription(subscriptionId),
        getTransactions(subscriptionId, ''),
      ]);

      if (subscriptionResponse) {
        setSubscription(subscriptionResponse);
      }

      if (transactionsResponse) {
        setTransactions(transactionsResponse);
      }
      setLoading(false);
    })();
  }, [subscriptionId]);

  if (loading) {
    return <LoadingScreen />;
  } else if (subscription?.data && transactions?.data) {
    return (
      <>
        <div>
          <SubscriptionHeader subscription={subscription.data} />
          <Separator className={'relative bg-border mb-8 dashboard-header-highlight'} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Subscription Overview
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className={'grid gap-6 grid-cols-1 xl:grid-cols-6'}>
              <div className={'grid auto-rows-max gap-6 grid-cols-1 xl:col-span-2'}>
                <SubscriptionNextPaymentCard transactions={transactions.data} subscription={subscription.data} />
                <SubscriptionPastPaymentsCard
                  transactions={transactions.data}
                  subscriptionId={subscriptionId}
                  onViewAll={() => setActiveTab('payments')}
                />
              </div>
              <div className={'grid auto-rows-max gap-6 grid-cols-1 xl:col-span-4'}>
                <SubscriptionLineItems subscription={subscription.data} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <PaymentsContent subscriptionId={subscriptionId} />
          </TabsContent>
        </Tabs>
      </>
    );
  } else {
    return <ErrorContent />;
  }
}
