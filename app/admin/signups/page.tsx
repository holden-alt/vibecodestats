import { redirect } from 'next/navigation';

export const runtime = 'edge';

/**
 * /admin/signups now redirects to /admin which contains the full funnel.
 */
export default function AdminSignupsPage() {
  redirect('/admin');
}
