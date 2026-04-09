import { redirect } from 'next/navigation';

/** BYOK must be evaluated at runtime from env, not at static build time. */
export const dynamic = 'force-dynamic';

export default function Home() {
  redirect('/chat');
}