import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/server';


export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url), { status: 302 });
  const database = await createClient();
  await database.auth.signOut();

  return response;
}
