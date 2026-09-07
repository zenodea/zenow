import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  (await getSession()).destroy();
  // 303 so the browser follows with GET after the form post.
  return Response.redirect(new URL("/login", request.url), 303);
}
