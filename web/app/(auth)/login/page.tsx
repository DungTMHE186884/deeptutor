"use client";

import { Suspense } from "react";
import { AuthPortal } from "@/components/auth/AuthPortal";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[var(--background)] flex items-center justify-center text-sm text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
            <span>Đang tải PathMind…</span>
          </div>
        </div>
      }
    >
      <AuthPortal initialTab="login" />
    </Suspense>
  );
}
