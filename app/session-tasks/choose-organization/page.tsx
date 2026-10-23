import { TaskChooseOrganization } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function ChooseOrganization() {
  const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) redirect("/sign-in");
  if (orgId) redirect("/");
  return <main id="main-content" className="auth-page"><TaskChooseOrganization redirectUrlComplete="/" /></main>;
}
