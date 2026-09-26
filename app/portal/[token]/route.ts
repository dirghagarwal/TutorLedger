import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db/raw";
import { createParentPortalSessionValue, createStudentPortalSessionValue, getParentPortalCookieName, getStudentPortalCookieName } from "@/lib/auth/parent-portal";

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const portal = await rawPrisma.parentPortal.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, expiresAt: true, revokedAt: true } });
  if (!portal || portal.revokedAt || portal.expiresAt.getTime() <= Date.now()) {
    return new NextResponse("Portal link is invalid or expired.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const response = NextResponse.redirect(new URL("/portal", request.url));
  const isStudent = token.startsWith("student_");
  response.cookies.set(isStudent ? getStudentPortalCookieName() : getParentPortalCookieName(), isStudent ? createStudentPortalSessionValue(portal.id, portal.expiresAt) : createParentPortalSessionValue(portal.id, portal.expiresAt), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: portal.expiresAt,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
