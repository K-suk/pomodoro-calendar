import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PomodoroCalendar } from '@/components/calendar/pomodoro-calendar';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return <PomodoroCalendar />;
}
