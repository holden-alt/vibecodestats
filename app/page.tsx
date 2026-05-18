import { redirect } from 'next/navigation';

export const runtime = 'edge';

export default function HomePage() {
  redirect('/holden-alt');
}
