"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Radio, Share2, X } from "lucide-react";
import {
  createStudyRoom,
  fetchFriendsList,
  fetchPartnerShares,
  revokePartnerShare,
  sharePartnerWithFriend,
  type FriendItem,
  type PartnerShareRecipient,
} from "@/lib/friends-api";

/**
 * Share a partner you own with friends (they can chat with it, not edit it),
 * or open a study room bound to it.
 */
export default function SharePartnerModal({
  partnerId,
  partnerName,
  onClose,
}: {
  partnerId: string;
  partnerName: string;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [shares, setShares] = useState<PartnerShareRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [roomName, setRoomName] = useState(`Phòng học: ${partnerName}`);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([
        fetchFriendsList(),
        fetchPartnerShares(partnerId),
      ]);
      setFriends(f);
      setShares(s);
      const sharedIds = new Set(s.map((x) => x.user_id));
      setSelected(
        (prev) =>
          prev || f.find((x) => !sharedIds.has(x.user_id))?.user_id || "",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(ok);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  }

  const sharedIds = new Set(shares.map((s) => s.user_id));
  const available = friends.filter((f) => !sharedIds.has(f.user_id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-raised max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-[var(--foreground)]">
            Chia sẻ {partnerName}
          </h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X size={18} />
          </button>
        </div>

        {(error || notice) && (
          <p
            className={`mb-3 text-sm ${error ? "text-destructive" : "text-success"}`}
          >
            {error || notice}
          </p>
        )}

        {/* Share with a friend */}
        <section className="mb-6">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Share2 size={15} className="text-primary" /> Chia sẻ cho bạn bè
          </h3>
          <p className="mb-3 text-xs text-[var(--muted-foreground)]">
            Bạn bè được trò chuyện với Partner này (mỗi người một cuộc trò
            chuyện riêng), không sửa được cấu hình.
          </p>
          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Đang tải...
            </p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Bạn chưa có bạn bè. Kết bạn ở tab &quot;Bạn bè&quot; của trang
              Partners.
            </p>
          ) : (
            <div className="flex gap-2">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                {available.length === 0 && (
                  <option value="">Đã chia sẻ cho tất cả bạn bè</option>
                )}
                {available.map((f) => (
                  <option key={f.user_id} value={f.user_id}>
                    {f.username}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !selected}
                onClick={() =>
                  void act(async () => {
                    await sharePartnerWithFriend(partnerId, selected);
                    setSelected("");
                  }, "Đã chia sẻ.")
                }
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Chia sẻ
              </button>
            </div>
          )}
          {shares.length > 0 && (
            <div className="mt-3 space-y-1">
              {shares.map((s) => (
                <div
                  key={s.share_id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
                >
                  <span className="text-[var(--foreground)]">{s.username}</span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => revokePartnerShare(s.share_id),
                        "Đã gỡ chia sẻ.",
                      )
                    }
                    className="text-xs text-[var(--muted-foreground)] hover:text-destructive"
                  >
                    Gỡ
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Study room */}
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Radio size={15} className="text-primary" /> Mở phòng học chung
          </h3>
          <p className="mb-3 text-xs text-[var(--muted-foreground)]">
            Ai có mã phòng đều vào được và dùng Partner này khi còn trong phòng.
            Quản lý phòng ở tab &quot;Bạn bè&quot;.
          </p>
          {roomCode ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <span className="font-mono text-xl font-semibold tracking-widest text-primary">
                {roomCode}
              </span>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(roomCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} Sao chép
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={120}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
              <button
                disabled={busy || !roomName.trim()}
                onClick={() =>
                  void act(async () => {
                    const room = await createStudyRoom(
                      roomName.trim(),
                      partnerId,
                    );
                    setRoomCode(room.room_code);
                  }, "Đã tạo phòng.")
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Tạo phòng
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
