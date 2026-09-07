import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireSession(): Promise<void> {
  if (!(await getSession()).loggedIn) redirect("/login");
}
