import { withAuth } from "next-auth/middleware";
import { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    return;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public pages. (Route groups like "(app)" never appear in URLs, so the
        // old startsWith("/(app)") check protected nothing.)
        if (pathname === "/" || pathname.startsWith("/login")) {
          return true;
        }

        // Everything else requires a session.
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
