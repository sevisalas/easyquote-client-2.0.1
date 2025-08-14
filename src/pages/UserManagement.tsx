import { useState, useEffect } from "react";
import { Plus, Trash2, Users, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface User {
  id: string;
  email: string;
  organization?: {
    id: string;
    name: string;
    subscription_plan: string;
  };
  role?: string;
}

interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
  excel_limit: number;
  excel_extra: number;
  client_user_limit: number;
  client_user_extra: number;
  api_user_id: string;
  api_user_email?: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const { toast } = useToast();
  const { isSuperAdmin, isOrgAdmin, organization } = useSubscription();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (isSuperAdmin) {
        // Fetch all organizations 
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('*');
        
        setOrganizations(orgsData || []);

        // Fetch all users with their memberships
        const { data: membersData } = await supabase
          .from('organization_members')
          .select(`
            user_id,
            role,
            organization:organizations(*)
          `);

        const usersMap = new Map();
        membersData?.forEach(member => {
          if (!usersMap.has(member.user_id)) {
            usersMap.set(member.user_id, {
              id: member.user_id,
              organization: member.organization,
              role: member.role
            });
          }
        });

        setUsers(Array.from(usersMap.values()));
      } else if (isOrgAdmin && organization) {
        // Fetch only users from admin's organization
        const { data: membersData } = await supabase
          .from('organization_members')
          .select(`
            user_id,
            role,
            organization:organizations(*)
          `)
          .eq('organization_id', organization.id);

        const usersWithEmails = await Promise.all(
          (membersData || []).map(async (member) => {
            const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
            return {
              id: member.user_id,
              email: userData.user?.email || 'N/A',
              organization: member.organization,
              role: member.role
            };
          })
        );

        setUsers(usersWithEmails);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async () => {
    if (!newUserEmail || !selectedOrgId) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Sign up the user (they'll need to confirm email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: Math.random().toString(36).slice(-8), // Temporary password
      });

      if (authError) throw authError;

      if (authData.user) {
        // Add user to organization
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: selectedOrgId,
            user_id: authData.user.id,
            role: newUserRole,
          });

        if (memberError) throw memberError;

        toast({
          title: "Success",
          description: `User invited successfully. They will receive a confirmation email.`,
        });

        setNewUserEmail("");
        setNewUserRole("user");
        setSelectedOrgId("");
        fetchData();
      }
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    }
  };

  const removeUser = async (userId: string, orgId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', orgId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed successfully",
      });

      fetchData();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access user management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? "Manage all users and organizations" : "Manage your organization's users"}
          </p>
        </div>
      </div>

      {/* Organizations Overview (SuperAdmin only) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>API User</TableHead>
                  <TableHead>Excel Limit</TableHead>
                  <TableHead>User Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.subscription_plan}</Badge>
                    </TableCell>
                    <TableCell>{org.api_user_email || 'N/A'}</TableCell>
                    <TableCell>{org.excel_limit + org.excel_extra}</TableCell>
                    <TableCell>{org.client_user_limit + org.client_user_extra}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite User */}
      {(isSuperAdmin || isOrgAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Invite New User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              
              {isSuperAdmin && (
                <div>
                  <Label htmlFor="organization">Organization</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={(value: "admin" | "user") => setNewUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={inviteUser}
              disabled={!newUserEmail || (isSuperAdmin && !selectedOrgId)}
            >
              Invite User
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.organization?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.organization?.subscription_plan || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Remove User</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to remove {user.email} from the organization?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            onClick={() => removeUser(user.id, user.organization?.id || '')}
                          >
                            Remove
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;