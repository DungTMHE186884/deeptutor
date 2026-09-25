import { apiFetch, apiUrl } from "@/lib/api";

export interface FriendItem {
  friendship_id: string;
  user_id: string;
  username: string;
  role: string;
  avatar?: string;
  created_at?: string;
  status?: string;
}

export interface PendingFriendRequest {
  request_id: string;
  requester_id: string;
  requester_username: string;
  created_at?: string;
}

export interface SentFriendRequest {
  request_id: string;
  target_id: string;
  target_username: string;
  created_at?: string;
}

export interface BlockedUser {
  request_id: string;
  user_id: string;
  username: string;
}

export interface SharedPartnerItem {
  share_id: string;
  partner_id: string;
  partner_name: string;
  owner_id: string;
  owner_username: string;
  permission: string;
  shared_at?: string;
}

export interface PartnerShareRecipient {
  share_id: string;
  user_id: string;
  username: string;
  shared_at?: string;
}

export interface StudyRoomMember {
  user_id: string;
  username: string;
  role: "host" | "participant";
  joined_at?: string;
}

export interface StudyRoomItem {
  room_code: string;
  room_name: string;
  host_id: string;
  host_username: string;
  is_host: boolean;
  partner_id?: string | null;
  partner_name?: string;
  is_active: boolean;
  created_at?: string;
  members: StudyRoomMember[];
}

async function call<T>(
  path: string,
  init?: RequestInit,
  fallback = "Request failed",
): Promise<T> {
  const res = await apiFetch(apiUrl(path), init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = (data as { detail?: unknown }).detail;
    throw new Error(typeof detail === "string" ? detail : fallback);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export async function fetchFriendsList(): Promise<FriendItem[]> {
  const data = await call<{ friends: FriendItem[] }>(
    "/api/friends/list",
    undefined,
    "Không tải được danh sách bạn bè",
  );
  return data.friends ?? [];
}

export function fetchFriendRequests(): Promise<{
  pending_requests: PendingFriendRequest[];
  sent_requests: SentFriendRequest[];
  blocked: BlockedUser[];
}> {
  return call(
    "/api/friends/pending",
    undefined,
    "Không tải được lời mời kết bạn",
  );
}

export function sendFriendRequest(
  target: string,
): Promise<{ status: string; message: string }> {
  return call("/api/friends/request", json({ target }), "Gửi lời mời thất bại");
}

export function respondFriendRequest(
  requestId: string,
  action: "accept" | "reject" | "block",
): Promise<unknown> {
  return call(
    "/api/friends/respond",
    json({ request_id: requestId, action }),
    "Xử lý lời mời thất bại",
  );
}

/** Cancel a request I sent, or lift a block I placed. */
export function cancelFriendRequest(requestId: string): Promise<unknown> {
  return call(
    `/api/friends/requests/${encodeURIComponent(requestId)}`,
    { method: "DELETE" },
    "Thao tác thất bại",
  );
}

export function removeFriend(friendUserId: string): Promise<unknown> {
  return call(
    `/api/friends/${encodeURIComponent(friendUserId)}`,
    { method: "DELETE" },
    "Huỷ kết bạn thất bại",
  );
}

// ---------------------------------------------------------------------------
// Partner sharing (/api/social)
// ---------------------------------------------------------------------------

export function sharePartnerWithFriend(
  partnerId: string,
  targetUserId: string,
): Promise<{ message: string }> {
  return call(
    `/api/social/partners/${encodeURIComponent(partnerId)}/share`,
    json({ target_user_id: targetUserId }),
    "Chia sẻ Partner thất bại",
  );
}

export async function fetchSharedPartners(): Promise<SharedPartnerItem[]> {
  const data = await call<{ shared_partners: SharedPartnerItem[] }>(
    "/api/social/partners/shared-with-me",
    undefined,
    "Không tải được Partner được chia sẻ",
  );
  return data.shared_partners ?? [];
}

export async function fetchPartnerShares(
  partnerId: string,
): Promise<PartnerShareRecipient[]> {
  const data = await call<{ shares: PartnerShareRecipient[] }>(
    `/api/social/partners/${encodeURIComponent(partnerId)}/shares`,
    undefined,
    "Không tải được danh sách chia sẻ",
  );
  return data.shares ?? [];
}

export function revokePartnerShare(shareId: string): Promise<unknown> {
  return call(
    `/api/social/shares/${encodeURIComponent(shareId)}`,
    { method: "DELETE" },
    "Gỡ chia sẻ thất bại",
  );
}

// ---------------------------------------------------------------------------
// Study rooms (/api/social/rooms)
// ---------------------------------------------------------------------------

export function createStudyRoom(
  roomName: string,
  partnerId?: string,
): Promise<StudyRoomItem> {
  return call(
    "/api/social/rooms",
    json({ room_name: roomName, partner_id: partnerId ?? null }),
    "Tạo phòng thất bại",
  );
}

export async function fetchMyRooms(): Promise<StudyRoomItem[]> {
  const data = await call<{ rooms: StudyRoomItem[] }>(
    "/api/social/rooms",
    undefined,
    "Không tải được phòng học",
  );
  return data.rooms ?? [];
}

export function joinStudyRoom(roomCode: string): Promise<StudyRoomItem> {
  return call(
    `/api/social/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/join`,
    { method: "POST" },
    "Mã phòng không tồn tại hoặc phòng đã đóng",
  );
}

export function leaveStudyRoom(roomCode: string): Promise<{ closed: boolean }> {
  return call(
    `/api/social/rooms/${encodeURIComponent(roomCode)}/leave`,
    { method: "POST" },
    "Rời phòng thất bại",
  );
}

export function closeStudyRoom(roomCode: string): Promise<unknown> {
  return call(
    `/api/social/rooms/${encodeURIComponent(roomCode)}`,
    { method: "DELETE" },
    "Đóng phòng thất bại",
  );
}

export function removeRoomMember(
  roomCode: string,
  userId: string,
): Promise<StudyRoomItem> {
  return call(
    `/api/social/rooms/${encodeURIComponent(roomCode)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
    "Mời thành viên ra thất bại",
  );
}
