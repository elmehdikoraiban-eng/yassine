import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET manquant.");
  return new TextEncoder().encode(value);
};

function platformAdmins() {
  return new Set((process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("cabinet_session")?.value;
  if (!token) {
    if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    return NextResponse.redirect(new URL("/connexion", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret());
    const cabinetId = typeof payload.cabinetId === "string" ? payload.cabinetId : "";
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!cabinetId) throw new Error("Session sans cabinet.");

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-cabinet-id", cabinetId);
    requestHeaders.set("x-platform-admin", platformAdmins().has(email) ? "1" : "0");
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    const response = req.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Session invalide." }, { status: 401 })
      : NextResponse.redirect(new URL("/connexion", req.url));
    response.cookies.delete("cabinet_session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!connexion|inscription|_next|favicon.ico).*)"],
};
