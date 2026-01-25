import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AuthButton } from '@/components/auth-button';

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
                    <h1 className="text-xl font-bold">Dashboard</h1>
                    <AuthButton />
                </div>
            </header>
            <main className="container mx-auto px-4 py-8">
                <div className="bg-card rounded-lg border p-6">
                    <h2 className="text-2xl font-semibold mb-4">Welcome, {user.user_metadata?.full_name ?? user.email}!</h2>
                    <p className="text-muted-foreground">
                        You are now logged in. This is a protected dashboard page.
                    </p>
                    <div className="mt-6 p-4 bg-muted rounded-md">
                        <h3 className="font-medium mb-2">User Info</h3>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                            <li><strong>ID:</strong> {user.id}</li>
                            <li><strong>Email:</strong> {user.email}</li>
                            <li><strong>Name:</strong> {user.user_metadata?.full_name ?? 'N/A'}</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}
