"use client";

import { LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { api } from "@/lib/client/api";

export function UserMenu({ user }: { user: { name: string; email: string; role: string } }) {
  const router = useRouter();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="ml-1 rounded-full transition hover:opacity-90" aria-label="Menu du profil">
          <UserAvatar name={user.name} size={30} />
        </button>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-2.5 py-2">
          <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
          <div className="truncate text-xs text-ink-3">{user.email}</div>
          <div className="mt-1 text-[11px] text-ink-3">{user.role === "admin" ? "Administrateur" : "Membre"}</div>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/parametres?tab=account")}>
          <User /> Mon compte
        </MenuItem>
        <MenuItem onSelect={() => router.push("/parametres")}>
          <Settings /> Paramètres
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger onSelect={logout}>
          <LogOut /> Se déconnecter
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
