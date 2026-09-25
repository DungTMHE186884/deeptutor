import type { AuthStatus } from "@/lib/auth";

export interface SettingsAccess {
  /** False until the backend has resolved the runtime auth mode and account. */
  resolved: boolean;
  /** Admin-owned settings stay hidden on auth failures and for ordinary users. */
  hideAdminOnly: boolean;
  /** Account pages (profile, billing) need a signed-in user with auth on. */
  authEnabled: boolean;
}

export const PENDING_SETTINGS_ACCESS: SettingsAccess = {
  resolved: false,
  hideAdminOnly: true,
  authEnabled: false,
};

/** Convert the backend's account identity into the settings visibility model. */
export function settingsAccessFromAuthStatus(
  authStatus: AuthStatus | null,
): SettingsAccess {
  if (!authStatus) {
    return { ...PENDING_SETTINGS_ACCESS, resolved: true };
  }

  return {
    resolved: true,
    hideAdminOnly: Boolean(authStatus.enabled) && !authStatus.is_admin,
    authEnabled: Boolean(authStatus.enabled && authStatus.authenticated),
  };
}
