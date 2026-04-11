import { getSessionUser } from "@/lib/auth";
import { HomeClient } from "./home-client";

export default async function Home() {
  const user = await getSessionUser();
  return <HomeClient userEmail={user?.email ?? null} />;
}
