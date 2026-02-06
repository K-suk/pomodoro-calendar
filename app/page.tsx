import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { LoginPage } from '@/components/login-page';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 認証済みユーザーは自動的にダッシュボードへ
  if (user) {
    redirect('/dashboard');
  }

  return <LoginPage />;
}
