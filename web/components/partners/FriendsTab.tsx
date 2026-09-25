"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  Copy,
  DoorOpen,
  Radio,
  Search,
  Share2,
  ShieldOff,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  cancelFriendRequest,
  closeStudyRoom,
  fetchFriendRequests,
  fetchFriendsList,
  fetchMyRooms,
  fetchSharedPartners,
  joinStudyRoom,
  leaveStudyRoom,
  removeFriend,
  removeRoomMember,
  respondFriendRequest,
  revokePartnerShare,
  sendFriendRequest,
  type BlockedUser,
  type FriendItem,
  type PendingFriendRequest,
  type SentFriendRequest,
  type SharedPartnerItem,
  type StudyRoomItem,
} from "@/lib/friends-api";

const card = "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5";
const input =
  "flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)]";
const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";
const ghostBtn =
  "rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-muted hover:text-[var(--foreground)]";

type Confirm =
  | { kind: "unfriend"; friend: FriendItem }
  | { kind: "leave"; room: StudyRoomItem }
  | null;

export default function FriendsTab() {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incoming, setIncoming] = useState<PendingFriendRequest[]>([]);
  const [sent, setSent] = useState<SentFriendRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [shared, setShared] = useState<SharedPartnerItem[]>([]);
  const [rooms, setRooms] = useState<StudyRoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [target, setTarget] = useState("");
  const [sending, setSending] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [f, requests, s, r] = await Promise.all([
        fetchFriendsList(),
        fetchFriendRequests(),
        fetchSharedPartners(),
        fetchMyRooms(),
      ]);
      setFriends(f);
      setIncoming(requests.pending_requests ?? []);
      setSent(requests.sent_requests ?? []);
      setBlocked(requests.blocked ?? []);
      setShared(s);
      setRooms(r);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không tải được dữ liệu bạn bè",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError("");
    try {
      await fn();
      if (ok) setNotice(ok);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại");
    }
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    setSending(true);
    await run(async () => {
      const res = await sendFriendRequest(target.trim());
      setNotice(res.message);
      setTarget("");
    });
    setSending(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setJoining(true);
    await run(async () => {
      const room = await joinStudyRoom(roomCode);
      setNotice(`Đã vào phòng "${room.room_name}".`);
      setRoomCode("");
    });
    setJoining(false);
  }

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    if (confirm.kind === "unfriend") {
      await run(() => removeFriend(confirm.friend.user_id), "Đã huỷ kết bạn.");
    } else if (confirm.room.is_host) {
      await run(() => closeStudyRoom(confirm.room.room_code), "Đã đóng phòng.");
    } else {
      await run(() => leaveStudyRoom(confirm.room.room_code), "Đã rời phòng.");
    }
    setBusy(false);
    setConfirm(null);
  }

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1500);
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || notice) && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-success/30 bg-success-surface text-success"
          }`}
        >
          <span className="flex-1">{error || notice}</span>
          <button
            onClick={() => (error ? setError("") : setNotice(""))}
            aria-label="Đóng"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Add friend */}
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <UserPlus size={16} className="text-primary" /> Thêm bạn
          </h3>
          <form onSubmit={handleSend} className="flex gap-2">
            <div className="relative flex flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Tên đăng nhập hoặc email"
                className={`${input} pl-8`}
              />
            </div>
            <button
              type="submit"
              disabled={sending || !target.trim()}
              className={primaryBtn}
            >
              Gửi
            </button>
          </form>
          {sent.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs text-[var(--muted-foreground)]">
                Đã gửi, chờ phản hồi
              </div>
              {sent.map((r) => (
                <div
                  key={r.request_id}
                  className="flex items-center justify-between py-1 text-sm"
                >
                  <span className="text-[var(--foreground)]">
                    {r.target_username}
                  </span>
                  <button
                    onClick={() =>
                      void run(
                        () => cancelFriendRequest(r.request_id),
                        "Đã huỷ lời mời.",
                      )
                    }
                    className="text-xs text-[var(--muted-foreground)] hover:text-destructive"
                  >
                    Huỷ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join room */}
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Radio size={16} className="text-primary" /> Vào phòng học chung
          </h3>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Mã phòng 6 ký tự"
              maxLength={12}
              className={`${input} font-mono uppercase tracking-widest`}
            />
            <button
              type="submit"
              disabled={joining || !roomCode.trim()}
              className={primaryBtn}
            >
              Vào phòng
            </button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Phòng được tạo từ nút &quot;Chia sẻ&quot; trong trang cấu hình
            Partner. Thành viên phòng được trò chuyện với Partner của phòng (mỗi
            người một cuộc trò chuyện riêng).
          </p>
        </div>
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Lời mời kết bạn ({incoming.length})
          </h3>
          {incoming.map((r) => (
            <div
              key={r.request_id}
              className="flex items-center justify-between border-t border-[var(--border)] py-2 first:border-0"
            >
              <span className="text-sm font-medium text-[var(--foreground)]">
                {r.requester_username}
              </span>
              <div className="flex gap-1">
                <button
                  title="Đồng ý"
                  onClick={() =>
                    void run(
                      () => respondFriendRequest(r.request_id, "accept"),
                      "Đã kết bạn.",
                    )
                  }
                  className="rounded-md p-1.5 text-success hover:bg-success-surface"
                >
                  <Check size={16} />
                </button>
                <button
                  title="Từ chối"
                  onClick={() =>
                    void run(() => respondFriendRequest(r.request_id, "reject"))
                  }
                  className={ghostBtn}
                >
                  <X size={16} />
                </button>
                <button
                  title="Chặn"
                  onClick={() =>
                    void run(
                      () => respondFriendRequest(r.request_id, "block"),
                      "Đã chặn người dùng.",
                    )
                  }
                  className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-destructive/10 hover:text-destructive"
                >
                  <ShieldOff size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends */}
      <div className={card}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <Users size={16} className="text-primary" /> Bạn bè ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Chưa có bạn bè. Gửi lời mời bằng tên đăng nhập ở trên.
          </p>
        ) : (
          friends.map((f) => (
            <div
              key={f.user_id}
              className="flex items-center justify-between border-t border-[var(--border)] py-2 first:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {(f.username || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {f.username}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <UserCheck size={10} /> Bạn bè
                  </div>
                </div>
              </div>
              <button
                title="Huỷ kết bạn"
                onClick={() => setConfirm({ kind: "unfriend", friend: f })}
                className={ghostBtn}
              >
                <UserMinus size={15} />
              </button>
            </div>
          ))
        )}
        {blocked.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="mb-1.5 text-xs text-[var(--muted-foreground)]">
              Đã chặn
            </div>
            {blocked.map((b) => (
              <div
                key={b.request_id}
                className="flex items-center justify-between py-1 text-sm"
              >
                <span className="text-[var(--foreground)]">{b.username}</span>
                <button
                  onClick={() =>
                    void run(
                      () => cancelFriendRequest(b.request_id),
                      "Đã bỏ chặn.",
                    )
                  }
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Bỏ chặn
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared partners */}
      <div className={card}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <Share2 size={16} className="text-primary" /> Partner bạn bè chia sẻ (
          {shared.length})
        </h3>
        {shared.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Chưa có Partner nào được chia sẻ với bạn.
          </p>
        ) : (
          shared.map((sp) => (
            <div
              key={sp.share_id}
              className="flex items-center justify-between border-t border-[var(--border)] py-2 first:border-0"
            >
              <Link
                href={`/partners/${encodeURIComponent(sp.partner_id)}`}
                className="flex items-center gap-2.5 hover:underline"
              >
                <Bot size={16} className="text-primary" />
                <div>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {sp.partner_name}
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">
                    từ {sp.owner_username}
                  </div>
                </div>
              </Link>
              <button
                title="Gỡ khỏi danh sách"
                onClick={() => void run(() => revokePartnerShare(sp.share_id))}
                className={ghostBtn}
              >
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Rooms */}
      <div className={card}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <Radio size={16} className="text-primary" /> Phòng học của tôi (
          {rooms.length})
        </h3>
        {rooms.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Bạn chưa ở trong phòng học nào.
          </p>
        ) : (
          rooms.map((room) => (
            <div
              key={room.room_code}
              className="border-t border-[var(--border)] py-3 first:border-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {room.room_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <button
                      onClick={() => copyCode(room.room_code)}
                      className="inline-flex items-center gap-1 font-mono hover:text-[var(--foreground)]"
                    >
                      {room.room_code}{" "}
                      {copied === room.room_code ? (
                        <Check size={11} />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                    · chủ phòng {room.host_username}
                    {room.partner_id && (
                      <>
                        {" · "}
                        <Link
                          href={`/partners/${encodeURIComponent(room.partner_id)}`}
                          className="text-primary hover:underline"
                        >
                          {room.partner_name || room.partner_id}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setConfirm({ kind: "leave", room })}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] hover:text-destructive"
                >
                  <DoorOpen size={13} />{" "}
                  {room.is_host ? "Đóng phòng" : "Rời phòng"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {room.members.map((m) => (
                  <span
                    key={m.user_id}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-[var(--foreground)]"
                  >
                    {m.username}
                    {m.role === "host" && (
                      <span className="text-[10px] text-primary">chủ</span>
                    )}
                    {room.is_host && m.role !== "host" && (
                      <button
                        title="Mời ra khỏi phòng"
                        onClick={() =>
                          void run(() =>
                            removeRoomMember(room.room_code, m.user_id),
                          )
                        }
                        className="text-[var(--muted-foreground)] hover:text-destructive"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "unfriend"
            ? "Huỷ kết bạn?"
            : confirm?.room.is_host
              ? "Đóng phòng học?"
              : "Rời phòng học?"
        }
        tone="danger"
        confirmLabel="Xác nhận"
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === "unfriend"
          ? `Các Partner hai bạn chia sẻ cho nhau cũng sẽ bị gỡ.`
          : confirm?.room.is_host
            ? "Mọi thành viên sẽ mất quyền dùng Partner của phòng."
            : "Bạn sẽ mất quyền dùng Partner của phòng này."}
      </ConfirmDialog>
    </div>
  );
}
