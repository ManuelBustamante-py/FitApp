import { LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/db/server";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <form action={signOut} className="flex items-center gap-2">
      <span className="text-muted-foreground max-w-[12rem] truncate text-xs">
        {user.email}
      </span>
      <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
        <LogOut aria-hidden />
      </Button>
    </form>
  );
}
