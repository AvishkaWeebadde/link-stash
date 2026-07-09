import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { signup } from "@/app/actions/auth";
import { verifySession } from "@/lib/dal";

export default async function SignupPage() {
  if (await verifySession()) redirect("/library");
  return (
    <>
      <h2 className="mb-5 text-lg font-semibold">Create your library</h2>
      <AuthForm mode="signup" action={signup} />
    </>
  );
}
