'use client';

import { Suspense } from 'react';
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const FacebookIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

function LoginPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { t } = useLanguage();

    useEffect(() => {
        const errorParam = searchParams.get('error');
        if (errorParam) {
            const errorMessages: { [key: string]: string } = {
                'Callback': 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง',
                'OAuthCallback': 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย OAuth',
                'OAuthAccountNotLinked': 'อีเมลนี้ถูกใช้กับ provider อื่นแล้ว',
                'CredentialsSignin': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
                'Default': 'เกิดข้อผิดพลาด: ' + errorParam,
            };
            setError(errorMessages[errorParam] || errorMessages['Default']);
        }
    }, [searchParams]);

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading('credentials');
        setError(null);

        const result = await signIn('credentials', {
            email,
            password,
            loginType: 'user',
            redirect: false,
        });

        if (result?.error) {
            setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
            setLoading(null);
        } else if (result?.ok) {
            router.push('/dashboard');
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading('google');
        await signIn('google', { callbackUrl: "/dashboard" });
    };

    const handleFacebookSignIn = async () => {
        setLoading('facebook');
        await signIn('facebook', { callbackUrl: "/dashboard" });
    };

    return (
        <div className="w-full max-w-[400px]">
            <Card className="shadow-xl border rounded-2xl overflow-hidden bg-card">
                <CardHeader className="space-y-3 text-center pb-6 pt-10">
                    <div className="flex justify-center">
                        <Link href="/" className="flex items-center justify-center w-14 h-14 rounded-full bg-foreground text-background">
                            <img src="/centxo-logo.png" alt="Centxo" className="w-8 h-8 rounded" />
                        </Link>
                    </div>
                    <CardTitle className="text-xl font-bold tracking-tight text-foreground">{t('login.welcome')}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                        {t('login.subtitle')}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-6 sm:px-8 pb-8">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Continue with Google */}
                    <Button
                        variant="outline"
                        disabled={loading !== null}
                        onClick={handleGoogleSignIn}
                        className="w-full h-11 rounded-xl font-medium border bg-muted hover:bg-muted/80 justify-center gap-3"
                    >
                        {loading === 'google' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <GoogleIcon />
                                {t('login.google')}
                            </>
                        )}
                    </Button>

                    {/* Continue with Facebook */}
                    <Button
                        variant="outline"
                        disabled={loading !== null}
                        onClick={handleFacebookSignIn}
                        className="w-full h-11 rounded-xl font-medium border bg-muted hover:bg-muted/80 justify-center gap-3"
                    >
                        {loading === 'facebook' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <FacebookIcon />
                                {t('login.facebook')}
                            </>
                        )}
                    </Button>

                    {/* or */}
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-card px-3 text-sm text-muted-foreground">{t('login.or')}</span>
                        </div>
                    </div>

                    {/* Continue with Email - button or form */}
                    {showEmailForm ? (
                        <form onSubmit={handleEmailSignIn} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading !== null}
                                    className="h-11 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading !== null}
                                    className="h-11 rounded-xl"
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading !== null}
                                className="w-full h-11 rounded-xl font-medium"
                            >
                                {loading === 'credentials' ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    t('login.signIn', 'Sign In')
                                )}
                            </Button>
                        </form>
                    ) : (
                        <Button
                            variant="outline"
                            disabled={loading !== null}
                            onClick={() => setShowEmailForm(true)}
                            className="w-full h-11 rounded-xl font-medium border bg-muted/30 hover:bg-muted/50 justify-center gap-3"
                        >
                            <Mail className="h-5 w-5" />
                            {t('login.continueWithEmail', 'Continue with Email')}
                        </Button>
                    )}

                    <p className="text-xs text-center text-muted-foreground pt-2">
                        {t('login.terms')}{" "}
                        <Link href="/terms" className="text-primary hover:underline">{t('login.termsLink')}</Link>
                        {t('login.and')}{" "}
                        <Link href="/privacy" className="text-primary hover:underline">{t('login.privacyLink')}</Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <LoginPageContent />
        </Suspense>
    );
}
