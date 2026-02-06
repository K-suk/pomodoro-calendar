'use client';

import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';

export function LoginPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
        } catch (error) {
            console.error('Error signing in with Google:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display antialiased">
            {/* Left Side: Login Form */}
            <div className="flex flex-col w-full lg:w-1/2 bg-white dark:bg-background-dark px-8 md:px-16 lg:px-24 xl:px-32 justify-center">
                <div className="max-w-[420px] w-full mx-auto">
                    {/* Brand Header */}
                    <div className="flex items-center gap-3">
                        <img src="/images/logo.png" alt="Pomodoro Calendar" className="size-36 mb-[56px]" />
                        <div className="mb-8">
                            <h1 className="text-[#1b0e0e] dark:text-white tracking-tight text-[36px] font-bold leading-tight pb-2">Sign in</h1>
                            <p className="text-[#1b0e0e]/70 dark:text-white/60 text-base font-normal leading-normal">Everthing for the most productive day is here.</p>
                        </div>
                    </div>
                    {/* Form Section */}

                    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                        {/* Google Button */}
                        <button
                            className="w-full flex items-center justify-center gap-3 rounded-lg h-12 px-4 border border-[#e7d0d1] dark:border-white/10 bg-white dark:bg-white/5 text-[#1b0e0e] dark:text-white text-base font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="size-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                                </svg>
                            )}
                            <span>Sign in with Google</span>
                        </button>
                    </form>
                </div>
            </div>
            {/* Right Side: Visual Minimalist Space */}
            <div className="hidden lg:flex flex-1 bg-google-gray dark:bg-[#1a0f0f] relative overflow-hidden items-center justify-center">
                {/* Subtle Geometric Background */}
                <div className="absolute inset-0 geometric-pattern opacity-50 dark:opacity-20"
                    style={{
                        backgroundImage: 'radial-gradient(#ea2a3315 1px, transparent 1px)',
                        backgroundSize: '32px 32px'
                    }}
                ></div>
                {/* Abstract Industrial Graphic */}
                <div className="relative z-10 flex flex-col items-center max-w-md text-center p-12">
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {/* Representing a calendar grid / pomodoro blocks */}
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                        <div className="size-16 bg-primary rounded-lg shadow-md flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-3xl">timer</span>
                        </div>
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                        <div className="size-16 bg-white dark:bg-white/10 rounded-lg shadow-sm"></div>
                    </div>
                    <h3 className="text-2xl font-bold text-[#1b0e0e] dark:text-white mb-2">Focus on what matters.</h3>
                    <p className="text-[#1b0e0e]/50 dark:text-white/40 text-sm leading-relaxed">
                        Designed for precision. Built for speed. Our industrial interface ensures your focus remains on your timeline, not the tool.
                    </p>
                </div>
                {/* Accent line */}
                <div className="absolute bottom-12 left-12 h-1 w-24 bg-primary/30"></div>
            </div>
        </div>
    );
}
