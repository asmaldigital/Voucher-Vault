import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { LogOut, User } from 'lucide-react';
import logoPng from "@assets/supersave-logo_1767626702003.png";

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex items-center gap-2">
          <img src={logoPng} alt="SuperSave Logo" className="h-8 w-8 object-contain" />
          <span className="hidden text-lg font-semibold md:inline-block">SuperSave</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
              <User className="h-4 w-4" />
              <span data-testid="text-user-email">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              data-testid="button-logout"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
