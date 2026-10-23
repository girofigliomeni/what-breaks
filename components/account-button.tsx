"use client";

import { UserButton } from "@clerk/nextjs";
import { useRef } from "react";
import { ThemeControl } from "@/components/theme-control";

export function AccountButton() {
  const settings = useRef<HTMLDialogElement>(null);
  return <>
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action label="Settings" labelIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></svg>} onClick={() => settings.current?.showModal()} />
      </UserButton.MenuItems>
    </UserButton>
    <dialog className="account-settings" ref={settings} aria-labelledby="settings-heading">
      <div className="settings-heading">
        <h2 id="settings-heading">Settings</h2>
        <form method="dialog"><button className="button">Close</button></form>
      </div>
      <ThemeControl />
    </dialog>
  </>;
}
