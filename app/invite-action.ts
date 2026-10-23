"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";

export async function inviteTeammate(_previous: { message: string }, form: FormData) {
  const { userId, orgId, has } = await auth.protect();
  if (!orgId || !has({ role: "org:admin" })) return { message: "Only a team administrator can invite members." };
  const email = form.get("email");
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { message: "Enter a valid email address." };
  }
  // Server Actions validate Origin against Host before invocation. Use that origin so local invitations stay local.
  const origin = (await headers()).get("origin");
  if (!origin || !/^https?:\/\//.test(origin)) return { message: "The application URL is unavailable. Reload and try again." };
  try {
    const clerk = await clerkClient();
    await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: userId,
      emailAddress: email.trim(),
      role: "org:member",
      redirectUrl: new URL("/sign-in", origin).toString(),
    });
    return { message: "Invitation sent." };
  } catch (error) {
    console.error("Clerk organization invitation failed", error);
    return { message: "Invitation could not be sent. Check the address and try again." };
  }
}
