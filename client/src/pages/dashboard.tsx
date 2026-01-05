import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  CheckCircle2,
  Clock,
  TrendingUp,
  Banknote,
  Calendar,
} from 'lucide-react';
import { Link } from 'wouter';
import type { DashboardStats } from '@shared/schema';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'info';
}) {
  const iconColors = {
    default: 'text-muted-foreground',
    success: 'text-primary',
    warning: 'text-yellow-600 dark:text-yellow-500',
    info: 'text-blue-600 dark:text-blue-500',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-5 w-5 ${iconColors[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-20" />
        <Skeleton className="mt-2 h-4 w-32" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString('en-ZA')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your voucher management system
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Clock className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Failed to load dashboard</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please check your connection and try again.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your voucher management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Vouchers"
          value={stats?.totalVouchers ?? 0}
          subtitle="All vouchers in system"
          icon={Ticket}
          variant="default"
        />
        <StatCard
          title="Available"
          value={stats?.availableVouchers ?? 0}
          subtitle="Ready for redemption"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Redeemed Today"
          value={stats?.redeemedToday ?? 0}
          subtitle={new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}
          icon={Calendar}
          variant="info"
        />
        <StatCard
          title="Total Redeemed"
          value={stats?.redeemedTotal ?? 0}
          subtitle="All time redemptions"
          icon={TrendingUp}
          variant="warning"
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(stats?.totalValue ?? 0)}
          subtitle="Value of all vouchers"
          icon={Banknote}
          variant="default"
        />
        <StatCard
          title="Redeemed Value"
          value={formatCurrency(stats?.redeemedValue ?? 0)}
          subtitle="Value redeemed"
          icon={Banknote}
          variant="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/scan">
              <Badge variant="outline" className="cursor-pointer px-4 py-2 text-sm" data-testid="link-quick-scan">
                Scan Voucher
              </Badge>
            </Link>
            <Link href="/vouchers">
              <Badge variant="outline" className="cursor-pointer px-4 py-2 text-sm" data-testid="link-quick-vouchers">
                View All Vouchers
              </Badge>
            </Link>
            <Link href="/import">
              <Badge variant="outline" className="cursor-pointer px-4 py-2 text-sm" data-testid="link-quick-import">
                Import Vouchers
              </Badge>
            </Link>
            <Link href="/reports">
              <Badge variant="outline" className="cursor-pointer px-4 py-2 text-sm" data-testid="link-quick-reports">
                View Reports
              </Badge>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
