"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { LoginSchema, SignupSchema } from "@/lib/validation";

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { name, email, passwordHash },
    select: { id: true },
  });

  await createSession(user.id);
  redirect("/library");
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  // Always run a hash compare to reduce timing side-channels on user existence.
  const hash =
    user?.passwordHash ?? "$2a$12$0000000000000000000000000000000000000000000000000000";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  redirect("/library");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
