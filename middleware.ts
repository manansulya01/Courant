import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== request.nextUrl.origin) {
          return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
      }
    } else if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Cross-site requests are not accepted." }, { status: 403 });
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
