"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchAuthStatus, type AuthStatus } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";

/**
 * The only item in the sidebar footer: the account card. It opens Settings
 * (Profile page); Sign out and Admin live at the bottom of the Settings
 * navigation. Without multi-user auth there is no account, so it falls back
 * to a plain Settings link.
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    fetchAuthStatus()
      .then((next) => {
        if (next?.enabled && next?.authenticated) setStatus(next);
      })
      .finally(() => setResolved(true));
  }, []);

  const active = pathname.startsWith("/settings");
  const expandedClass = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
    active
      ? "bg-[var(--accent)] text-[var(--foreground)]"
      : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
  }`;
  const collapsedClass = `mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
    active ? "bg-[var(--accent)]" : "hover:bg-background/60"
  }`;

  if (!status?.username) {
    if (!resolved) return null;
    return (
      <Link
        href="/settings/general"
        title={t("Settings")}
        aria-label={t("Settings")}
        className={collapsed ? collapsedClass : expandedClass}
      >
        <Settings size={16} strokeWidth={1.6} />
        {!collapsed && <span>{t("Settings")}</span>}
      </Link>
    );
  }

  return (
    <Link
      href="/settings/profile"
      title={`${status.username} — ${t("Settings")}`}
      aria-label={`${status.username} — ${t("Settings")}`}
      className={collapsed ? collapsedClass : expandedClass}
    >
      <UserAvatar
        username={status.username}
        userId={status.user_id}
        avatar={status.avatar}
        role={status.role}
        size={collapsed ? 18 : 16}
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{status.username}</span>}
    </Link>
  );
}
