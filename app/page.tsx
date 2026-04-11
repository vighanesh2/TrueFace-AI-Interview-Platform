import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { HomeClient } from "./home-client";

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }
  return <HomeClient />;
}
