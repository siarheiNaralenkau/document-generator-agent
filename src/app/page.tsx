import { redirect } from 'next/navigation';
import { LoginPage } from './components/LoginPage';
import { isByokMode } from '@/lib/byok';

/** BYOK must be evaluated at runtime from env, not at static build time. */
export const dynamic = 'force-dynamic';

export default function Home() {
  if (isByokMode()) {
    redirect('/chat');
  }
  return <LoginPage />;
}