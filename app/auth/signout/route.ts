import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';

export const runtime = 'edge';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL('/', request.url), { status: 302 });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.signOut();

  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-')) {
      response.cookies.set(c.name, '', { path: '/', maxAge: 0 });
    }
  }

  return response;
}
