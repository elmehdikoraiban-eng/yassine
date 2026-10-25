import { NextResponse, type NextRequest } from "next/server";

// Redirection rapide vers la connexion ; la session est vérifiée côté serveur sur chaque page.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("cabinet_session")) {
    return NextResponse.redirect(new URL("/connexion", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!connexion|api|_next|favicon.ico).*)"],
};
