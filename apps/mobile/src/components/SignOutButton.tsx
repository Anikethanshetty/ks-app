import { useState } from "react";
import { LinkButton } from "./ui";
import { useSession } from "@/lib/session";

/** Ends the session; the root guard then falls back to the login screen. */
export function SignOutButton() {
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <LinkButton
      label="Sign out"
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
