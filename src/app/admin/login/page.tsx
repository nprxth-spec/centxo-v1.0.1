'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/admin';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email,
                password,
                loginType: 'admin',
                redirect: false,
                callbackUrl,
            });

            if (result?.error) {
                setError('Invalid credentials');
                setLoading(false);
            } else {
                router.push(callbackUrl);
            }
        } catch (err) {
            setError('An error occurred');
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md border-gray-800 bg-gray-900/50 backdrop-blur">
            <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 rounded-full bg-blue-900/30 ring-1 ring-blue-800">
                        <ShieldCheck className="h-8 w-8 text-blue-500" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-white">Super Admin Portal</CardTitle>
                <CardDescription className="text-gray-400">
                    Enter your secure credentials to access the system
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@centxo.com"
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-900/20"
                        disabled={loading}
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="text-center text-xs text-gray-500">
                Restricted Access Area. IP Address Logged.
            </CardFooter>
        </Card>
    );
}

export default function AdminLoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
            <Suspense fallback={<div className="text-gray-400">Loading protected area...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
