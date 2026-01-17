import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, Shield, Edit, CheckCircle2, XCircle, Trash2, Loader2, Github } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { User, CreateUser } from '@shared/schema';
import { Redirect } from 'wouter';

function validatePassword(password: string) {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
  const isValid = Object.values(checks).every(Boolean);
  return { checks, isValid };
}

interface UserListItem {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');

  const { data: users = [], isLoading: usersLoading } = useQuery<UserListItem[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: isAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUser) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User created',
        description: 'The new user has been created successfully.',
      });
      setIsDialogOpen(false);
      setEmail('');
      setPassword('');
      setRole('editor');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User deleted',
        description: 'The user has been removed from the system.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/github/backup', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Backup failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Backup Successful',
        description: `Code backed up to ${data.owner}/${data.repo}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Backup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const passwordValidation = useMemo(() => validatePassword(password), [password]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValidation.isValid) {
      toast({
        title: 'Weak password',
        description: 'Please ensure your password meets all the requirements listed below.',
        variant: 'destructive',
      });
      return;
    }
    createUserMutation.mutate({ email, password, role });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">User Management</h1>
          <p className="text-muted-foreground">Manage staff accounts and permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new staff member to the voucher system.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="staff@supersave.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-user-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-user-password"
                />
                <div className="mt-2 space-y-1 text-xs">
                  <p className="font-medium text-muted-foreground mb-1">Password must have:</p>
                  <div className="flex items-center gap-1">
                    {passwordValidation.checks.minLength ? (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.checks.minLength ? 'text-primary' : 'text-muted-foreground'}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordValidation.checks.hasUppercase ? (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.checks.hasUppercase ? 'text-primary' : 'text-muted-foreground'}>
                      One uppercase letter (A-Z)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordValidation.checks.hasLowercase ? (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.checks.hasLowercase ? 'text-primary' : 'text-muted-foreground'}>
                      One lowercase letter (a-z)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordValidation.checks.hasNumber ? (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.checks.hasNumber ? 'text-primary' : 'text-muted-foreground'}>
                      One number (0-9)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordValidation.checks.hasSpecial ? (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.checks.hasSpecial ? 'text-primary' : 'text-muted-foreground'}>
                      One special character (!@#$%^&* etc.)
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: 'admin' | 'editor') => setRole(value)}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4" />
                        Editor - Can scan and redeem vouchers
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin - Full access including user management
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-create-user">
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Backup
            </CardTitle>
            <CardDescription>
              Back up your application code to a private GitHub repository
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Connect to GitHub</p>
                <p className="text-sm text-muted-foreground">
                  Sync your source code to a secure, private repository.
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => backupMutation.mutate()}
                disabled={backupMutation.isPending}
                data-testid="button-github-backup"
              >
                {backupMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Github className="mr-2 h-4 w-4" />
                )}
                Run Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Members
            </CardTitle>
            <CardDescription>
              {users.length} user{users.length !== 1 ? 's' : ''} registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No users found</div>
            ) : (
              <div className="divide-y">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-4"
                    data-testid={`row-user-${user.id}`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        data-testid={`badge-user-role-${user.id}`}
                      >
                        {user.role === 'admin' ? (
                          <><Shield className="mr-1 h-3 w-3" /> Admin</>
                        ) : (
                          <><Edit className="mr-1 h-3 w-3" /> Editor</>
                        )}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {user.email}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${user.id}`}
                            >
                              {deleteUserMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Delete'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
