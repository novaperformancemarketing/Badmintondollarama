import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, passcodeToken } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await passcodeToken(passcode))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, Next internals and static brand files.
  matcher: ['/((?!login|_next/|brand/|icon|apple-icon|manifest|favicon).*)'],
};
