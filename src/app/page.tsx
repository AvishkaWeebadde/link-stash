import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export default async function Home() {
  const session = await verifySession();
  redirect(session ? "/library" : "/login");
}
