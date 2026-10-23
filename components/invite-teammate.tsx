"use client";

import { useActionState } from "react";
import { inviteTeammate } from "@/app/invite-action";

export function InviteTeammate() {
  const [state, action, pending] = useActionState(inviteTeammate, { message: "" });
  return (
    <details className="invite-menu">
      <summary className="button">Invite teammate</summary>
      <form action={action} className="invite-form">
        <label htmlFor="invite-email">Teammate email</label>
        <input id="invite-email" name="email" type="email" autoComplete="email" maxLength={254} required />
        <button className="button" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button>
        <p role="status">{state.message}</p>
      </form>
    </details>
  );
}
