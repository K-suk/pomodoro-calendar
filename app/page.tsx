import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AuthButton } from '@/components/auth-button';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 認証済みユーザーは自動的にダッシュボードへ
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Pomodoro Calendar</h1>
          <p className="text-muted-foreground">
            Sign in to get started
          </p>
        </div>
        <div className="flex justify-center">
          <AuthButton />
        </div>
      </div>
    </div>
  );
}
