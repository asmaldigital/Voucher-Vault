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
  Users,
  TrendingUp,
  Wallet,
  Download,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import supersaveLogo from '@assets/supersave-logo_1767626702003.png';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    title: 'Scan & Redeem',
    url: '/scan',
    icon: ScanBarcode,
    adminOnly: false,
  },
  {
    title: 'Vouchers',
    url: '/vouchers',
    icon: ListChecks,
    adminOnly: false,
  },
  {
    title: 'Import',
    url: '/import',
    icon: Upload,
    adminOnly: false,
  },
  {
    title: 'Reports',
    url: '/reports',
    icon: FileBarChart,
    adminOnly: false,
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: TrendingUp,
    adminOnly: false,
  },
  {
    title: 'Accounts',
    url: '/accounts',
    icon: Wallet,
    adminOnly: false,
  },
  {
    title: 'Users',
    url: '/users',
    icon: Users,
    adminOnly: true,
  },
  {
    title: 'Export',
    url: '/export',
    icon: Download,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAdmin, userRole } = useAuth();
  
  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <img 
            src={supersaveLogo} 
            alt="SuperSave Logo" 
            className="h-10 w-10 object-contain"
          />
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
              {visibleMenuItems.map((item) => (
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
          {userRole && (
            <span className="text-xs text-muted-foreground capitalize" data-testid="sidebar-user-role">
              {userRole}
            </span>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
