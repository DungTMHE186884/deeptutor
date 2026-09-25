"""Social features around Partners: share with friends, and study rooms.

Mounted at ``/api/social`` (auth required on the whole router). It used to
share ``/api/partners`` with the main partners router, where its routes could
collide with ``/api/partners/{partner_id}``.

Access model (enforced in ``multi_user.partner_access``):

* Sharing a partner gives the friend **use** access (chat with it). Only the
  partner's manager (its owner, or an admin) can share, and only with an
  accepted friend. Managing (soul, channels, deletion) is never shared.
* A study room may be bound to a partner the host manages. Every member of an
  active room gets **use** access to that partner while they are in the room.
  Rooms group people around one partner; each member keeps their own
  conversation thread with it (no shared realtime transcript).
"""

from __future__ import annotations

import logging
import secrets
import string
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from pathmind.api.routers.friends import are_friends
from pathmind.database.connection import get_db
from pathmind.database.models import PartnerShare, RoomMember, SharedRoom
from pathmind.multi_user.context import get_current_user
from pathmind.services.quota_service import ensure_db_user

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_ROOM_MEMBERS = 30
_CODE_ALPHABET = string.ascii_uppercase + string.digits


class ShareBody(BaseModel):
    target_user_id: str = Field(min_length=1, max_length=64)


class CreateRoomBody(BaseModel):
    room_name: str = Field(min_length=1, max_length=120)
    partner_id: str | None = None


def _me(db: Session):
    user = get_current_user()
    ensure_db_user(db, user.id, user.username, user.role)
    return user


def _usernames() -> dict[str, str]:
    from pathmind.services.auth import list_users

    try:
        return {str(u.get("id") or ""): str(u.get("username") or "") for u in list_users()}
    except Exception:
        return {}


def _partner_names() -> dict[str, str]:
    try:
        from pathmind.services.partners import get_partner_manager

        return {
            str(p.get("partner_id") or ""): str(p.get("name") or p.get("partner_id") or "")
            for p in get_partner_manager().list_partners()
        }
    except Exception:
        return {}


def _iso(value) -> str:
    return value.isoformat() + "Z" if value else ""


def _require_manageable(partner_id: str) -> None:
    from pathmind.multi_user.partner_access import can_manage_partner

    if partner_id not in _partner_names():
        raise HTTPException(status_code=404, detail="Partner không tồn tại.")
    if not can_manage_partner(partner_id):
        raise HTTPException(status_code=403, detail="Bạn chỉ có thể chia sẻ Partner do mình tạo.")


# ---------------------------------------------------------------------------
# Partner sharing
# ---------------------------------------------------------------------------


@router.post("/partners/{partner_id}/share")
async def share_partner(partner_id: str, body: ShareBody, db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    _require_manageable(partner_id)
    if body.target_user_id == me.id:
        raise HTTPException(status_code=400, detail="Không thể chia sẻ cho chính mình.")
    if not are_friends(db, me.id, body.target_user_id):
        raise HTTPException(status_code=403, detail="Chỉ có thể chia sẻ Partner cho bạn bè đã kết bạn.")
    ensure_db_user(db, body.target_user_id)
    existing = (
        db.query(PartnerShare)
        .filter_by(partner_id=partner_id, owner_id=me.id, shared_with_id=body.target_user_id)
        .first()
    )
    if not existing:
        db.add(
            PartnerShare(
                partner_id=partner_id,
                owner_id=me.id,
                shared_with_id=body.target_user_id,
                permission="use",
            )
        )
        db.commit()
    name = _usernames().get(body.target_user_id, "bạn của bạn")
    return {"status": "ok", "message": f"Đã chia sẻ Partner với {name}."}


@router.get("/partners/shared-with-me")
async def shared_with_me(db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    names, partners = _usernames(), _partner_names()
    rows = db.query(PartnerShare).filter_by(shared_with_id=me.id).all()
    return {
        "shared_partners": [
            {
                "share_id": r.id,
                "partner_id": r.partner_id,
                "partner_name": partners.get(r.partner_id, r.partner_id),
                "owner_id": r.owner_id,
                "owner_username": names.get(r.owner_id, ""),
                "permission": r.permission or "use",
                "shared_at": _iso(r.created_at),
            }
            for r in rows
            if r.partner_id in partners  # partner deleted → hide
        ]
    }


@router.get("/partners/{partner_id}/shares")
async def list_partner_shares(partner_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    _me(db)
    _require_manageable(partner_id)
    names = _usernames()
    rows = db.query(PartnerShare).filter_by(partner_id=partner_id).all()
    return {
        "shares": [
            {
                "share_id": r.id,
                "user_id": r.shared_with_id,
                "username": names.get(r.shared_with_id, "(đã xoá)"),
                "shared_at": _iso(r.created_at),
            }
            for r in rows
        ]
    }


@router.delete("/shares/{share_id}")
async def revoke_share(share_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """The owner revokes it, or the recipient removes it from their list."""
    me = _me(db)
    row = db.get(PartnerShare, share_id)
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt chia sẻ.")
    if me.id not in {row.owner_id, row.shared_with_id} and not me.is_admin:
        raise HTTPException(status_code=403, detail="Bạn không thể gỡ lượt chia sẻ này.")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Study rooms
# ---------------------------------------------------------------------------


def _new_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not db.query(SharedRoom).filter_by(room_code=code).first():
            return code
    raise HTTPException(status_code=500, detail="Không tạo được mã phòng, hãy thử lại.")


def _room_or_404(db: Session, code: str) -> SharedRoom:
    room = (
        db.query(SharedRoom)
        .filter(SharedRoom.room_code == code.strip().upper(), SharedRoom.is_active.is_(True))
        .first()
    )
    if not room:
        raise HTTPException(status_code=404, detail="Phòng học không tồn tại hoặc đã đóng.")
    return room


def _room_view(db: Session, room: SharedRoom, me_id: str) -> dict[str, Any]:
    names, partners = _usernames(), _partner_names()
    members = db.query(RoomMember).filter_by(room_id=room.id).all()
    return {
        "room_code": room.room_code,
        "room_name": room.title,
        "title": room.title,
        "host_id": room.host_id,
        "host_username": names.get(room.host_id, ""),
        "is_host": room.host_id == me_id,
        "partner_id": room.partner_id,
        "partner_name": partners.get(room.partner_id or "", "") if room.partner_id else "",
        "is_active": bool(room.is_active),
        "created_at": _iso(room.created_at),
        "members": [
            {
                "user_id": m.user_id,
                "username": names.get(m.user_id, "(đã xoá)"),
                "role": m.role,
                "joined_at": _iso(m.joined_at),
            }
            for m in members
        ],
    }


@router.post("/rooms")
async def create_room(body: CreateRoomBody, db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    partner_id = (body.partner_id or "").strip() or None
    if partner_id:
        _require_manageable(partner_id)
    room = SharedRoom(
        room_code=_new_code(db),
        title=body.room_name.strip(),
        host_id=me.id,
        partner_id=partner_id,
        discussion_mode="round_robin",
        is_active=True,
    )
    db.add(room)
    db.flush()
    db.add(RoomMember(room_id=room.id, user_id=me.id, role="host"))
    db.commit()
    return _room_view(db, room, me.id)


@router.get("/rooms")
async def my_rooms(db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    room_ids = [m.room_id for m in db.query(RoomMember).filter_by(user_id=me.id).all()]
    rooms = (
        db.query(SharedRoom)
        .filter(SharedRoom.id.in_(room_ids), SharedRoom.is_active.is_(True))
        .order_by(SharedRoom.created_at.desc())
        .all()
        if room_ids
        else []
    )
    return {"rooms": [_room_view(db, r, me.id) for r in rooms]}


@router.get("/rooms/{room_code}")
async def get_room(room_code: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    room = _room_or_404(db, room_code)
    if not db.query(RoomMember).filter_by(room_id=room.id, user_id=me.id).first():
        raise HTTPException(status_code=403, detail="Bạn chưa tham gia phòng này.")
    return _room_view(db, room, me.id)


@router.post("/rooms/{room_code}/join")
async def join_room(room_code: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    room = _room_or_404(db, room_code)
    if not db.query(RoomMember).filter_by(room_id=room.id, user_id=me.id).first():
        if db.query(RoomMember).filter_by(room_id=room.id).count() >= MAX_ROOM_MEMBERS:
            raise HTTPException(status_code=409, detail="Phòng đã đủ thành viên.")
        db.add(RoomMember(room_id=room.id, user_id=me.id, role="participant"))
        db.commit()
    return _room_view(db, room, me.id)


@router.post("/rooms/{room_code}/leave")
async def leave_room(room_code: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Leave a room. When the host leaves, the room is closed."""
    me = _me(db)
    room = _room_or_404(db, room_code)
    if room.host_id == me.id:
        room.is_active = False
    else:
        db.query(RoomMember).filter_by(room_id=room.id, user_id=me.id).delete()
    db.commit()
    return {"status": "ok", "closed": room.host_id == me.id}


@router.delete("/rooms/{room_code}")
async def close_room(room_code: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    room = _room_or_404(db, room_code)
    if room.host_id != me.id and not me.is_admin:
        raise HTTPException(status_code=403, detail="Chỉ chủ phòng mới đóng được phòng.")
    room.is_active = False
    db.commit()
    return {"status": "ok"}


@router.delete("/rooms/{room_code}/members/{user_id}")
async def remove_member(room_code: str, user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    me = _me(db)
    room = _room_or_404(db, room_code)
    if room.host_id != me.id:
        raise HTTPException(status_code=403, detail="Chỉ chủ phòng mới mời thành viên ra.")
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="Hãy dùng 'Đóng phòng' thay vì tự mời mình ra.")
    db.query(RoomMember).filter_by(room_id=room.id, user_id=user_id).delete()
    db.commit()
    return _room_view(db, room, me.id)
