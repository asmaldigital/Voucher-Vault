import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ScanBarcode,
  ListChecks,
  Upload,
  FileBarChart,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Scan & Redeem',
    url: '/scan',
    icon: ScanBarcode,
  },
  {
    title: 'Vouchers',
    url: '/vouchers',
    icon: ListChecks,
  },
  {
    title: 'Import',
    url: '/import',
    icon: Upload,
  },
  {
    title: 'Reports',
    url: '/reports',
    icon: FileBarChart,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <span className="text-lg font-bold text-primary-foreground">SS</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold">SuperSave</span>
            <span className="text-xs text-muted-foreground">Voucher System</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Logged in as</span>
          <span className="truncate text-sm font-medium" data-testid="sidebar-user-email">
            {user?.email}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
