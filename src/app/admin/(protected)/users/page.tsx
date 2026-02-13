
import { PrismaClient } from '@prisma/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from 'date-fns';

const prisma = new PrismaClient();

type UserWithCount = {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    plan: string;
    createdAt: Date;
    _count: {
        accounts: number;
    };
};

export default async function AdminUsersPage() {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            plan: true,
            createdAt: true,
            _count: {
                select: { accounts: true }
            }
        } as any
    }) as unknown as UserWithCount[];

    // Fetch team memberships to identify Hosts
    const allMemberships = await prisma.teamMember.findMany({
        where: {
            memberEmail: { not: null }
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true
                }
            }
        }
    });

    // Map member email -> Host User
    const memberToHostMap = new Map<string, typeof allMemberships[0]['user']>();
    allMemberships.forEach(m => {
        if (m.memberEmail) {
            memberToHostMap.set(m.memberEmail, m.user);
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription>
                        List of all registered users and their current status.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Image</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Team Host</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Connected Accounts</TableHead>
                                <TableHead className="text-right">Created At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => {
                                const host = user.email ? memberToHostMap.get(user.email) : undefined;

                                return (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={user.image || ''} alt={user.name || ''} referrerPolicy="no-referrer" />
                                                <AvatarFallback>{user.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'SUPER_ADMIN' ? 'destructive' : 'secondary'}>
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {host ? (
                                                <div className="flex items-center gap-2" title={`Owned by ${host.email}`}>
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={host.image || ''} referrerPolicy="no-referrer" />
                                                        <AvatarFallback className="text-[10px]">{host.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">{host.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">Owner</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{user.plan}</Badge>
                                        </TableCell>
                                        <TableCell>{user._count.accounts}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {format(new Date(user.createdAt), 'MMM d, yyyy')}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
