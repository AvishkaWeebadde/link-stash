import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { login } from "@/app/actions/auth";
import { verifySession } from "@/lib/dal";

export default async function LoginPage() {
  if (await verifySession()) redirect("/library");
  return (
    <>
      <h2 className="mb-5 text-lg font-semibold">Welcome back</h2>
      <AuthForm mode="login" action={login} />
    </>
  );
}
