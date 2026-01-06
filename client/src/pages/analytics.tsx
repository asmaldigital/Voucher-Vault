import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth } from 'date-fns';

type PeriodData = { period: string; count: number; value: number };

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const getDateRange = () => {
    const end = new Date();
    let start: Date;
    let period: 'day' | 'week' | 'month' = groupBy;

    switch (timeRange) {
      case '7d':
        start = subDays(end, 7);
        period = 'day';
        break;
      case '30d':
        start = subDays(end, 30);
        period = 'day';
        break;
      case '90d':
        start = subDays(end, 90);
        period = 'week';
        break;
      case '12m':
        start = subMonths(end, 12);
        period = 'month';
        break;
      default:
        start = subDays(end, 30);
    }

    return { start, end, period };
  };

  const { start, end, period } = getDateRange();

  const queryParams = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    groupBy: period,
  }).toString();

  const { data: chartData, isLoading } = useQuery<PeriodData[]>({
    queryKey: [`/api/analytics/redemptions?${queryParams}`],
  });

  const { data: currentStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { totalCount: 0, totalValue: 0, avgDaily: 0, trend: 0 };
    }

    const totalCount = chartData.reduce((sum, d) => sum + d.count, 0);
    const totalValue = chartData.reduce((sum, d) => sum + d.value, 0);
    const avgDaily = totalCount / chartData.length;

    const halfLength = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, halfLength);
    const secondHalf = chartData.slice(halfLength);
    const firstHalfSum = firstHalf.reduce((sum, d) => sum + d.count, 0);
    const secondHalfSum = secondHalf.reduce((sum, d) => sum + d.count, 0);
    const trend = firstHalfSum > 0 ? ((secondHalfSum - firstHalfSum) / firstHalfSum) * 100 : 0;

    return { totalCount, totalValue, avgDaily: Math.round(avgDaily), trend: Math.round(trend) };
  }, [chartData]);

  const formatCurrency = (value: number) => `R${value.toLocaleString()}`;

  const formatPeriod = (period: string) => {
    if (!period) return '';
    if (period.includes('-W')) {
      const [year, week] = period.split('-IW');
      return `W${week} ${year}`;
    }
    if (period.match(/^\d{4}-\d{2}$/)) {
      return format(new Date(period + '-01'), 'MMM yyyy');
    }
    try {
      return format(new Date(period), 'MMM d');
    } catch {
      return period;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-muted-foreground">
            Track redemption trends and forecast performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d" data-testid="option-7d">Last 7 days</SelectItem>
              <SelectItem value="30d" data-testid="option-30d">Last 30 days</SelectItem>
              <SelectItem value="90d" data-testid="option-90d">Last 90 days</SelectItem>
              <SelectItem value="12m" data-testid="option-12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-redemptions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redemptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-period-redemptions">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card data-testid="card-value-redeemed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value Redeemed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-period-value">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(stats.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card data-testid="card-daily-average">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daily-average">
              {isLoading ? <Skeleton className="h-8 w-12" /> : stats.avgDaily}
            </div>
            <p className="text-xs text-muted-foreground">Redemptions per day</p>
          </CardContent>
        </Card>

        <Card data-testid="card-trend">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend</CardTitle>
            {stats.trend >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-primary" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${stats.trend >= 0 ? 'text-primary' : 'text-destructive'}`}
              data-testid="text-trend"
            >
              {isLoading ? <Skeleton className="h-8 w-16" /> : `${stats.trend > 0 ? '+' : ''}${stats.trend}%`}
            </div>
            <p className="text-xs text-muted-foreground">vs previous period</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="count" className="space-y-4">
        <TabsList>
          <TabsTrigger value="count" data-testid="tab-count">Redemption Count</TabsTrigger>
          <TabsTrigger value="value" data-testid="tab-value">Redemption Value</TabsTrigger>
        </TabsList>

        <TabsContent value="count">
          <Card>
            <CardHeader>
              <CardTitle>Redemptions Over Time</CardTitle>
              <CardDescription>
                Number of vouchers redeemed per {period === 'day' ? 'day' : period === 'week' ? 'week' : 'month'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={formatPeriod}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      labelFormatter={formatPeriod}
                      formatter={(value: number) => [value, 'Redemptions']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  No redemption data available for this period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="value">
          <Card>
            <CardHeader>
              <CardTitle>Redemption Value Over Time</CardTitle>
              <CardDescription>
                Total value redeemed per {period === 'day' ? 'day' : period === 'week' ? 'week' : 'month'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={formatPeriod}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `R${v / 1000}k`}
                    />
                    <Tooltip
                      labelFormatter={formatPeriod}
                      formatter={(value: number) => [formatCurrency(value), 'Value']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  No redemption data available for this period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
