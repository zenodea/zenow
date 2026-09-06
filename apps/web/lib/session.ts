import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { env } from "./env";

export type Session = { loggedIn?: true };

function sessionOptions(): SessionOptions {
  return {
    password: env.sessionSecret,
    cookieName: "reader_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    },
  };
}

export async function getSession() {
  return getIronSession<Session>(await cookies(), sessionOptions());
}
