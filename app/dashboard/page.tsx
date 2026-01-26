import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AuthButton } from '@/components/auth-button';
import { BlurteCalendar } from '@/components/calendar/blurte-calendar';

export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">Blurte</h1>
                    <AuthButton />
                </div>
            </header>
            <main className="container mx-auto px-4 py-8">
                <div className="mb-6 flex flex-col gap-2">
                    <h2 className="text-3xl font-semibold">
                        Welcome back, {user.user_metadata?.full_name ?? user.email}!
                    </h2>
                    <p className="text-muted-foreground">
                        Plan your focus sessions and track Pomodoro-friendly routines.
                    </p>
                </div>
                <BlurteCalendar />
            </main>
        </div>
    );
}
