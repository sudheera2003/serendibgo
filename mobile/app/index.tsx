import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-store';
import { HOME } from '@/lib/session';

export default function Index() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/welcome" />;
  return <Redirect href={HOME[user.role] as never} />;
}
