import { redirect } from 'next/navigation';


/**
 * /admin/signups now redirects to /admin which contains the full funnel.
 */
export default function AdminSignupsPage() {
  redirect('/admin');
}
