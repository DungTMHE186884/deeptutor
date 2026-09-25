<p align="center">
  <img src="web/public/banner.png" alt="PathMind" height="72" />
</p>

# PathMind

PathMind là trợ lý học tập AI: chat với gia sư AI, Partner (trợ lý riêng), học cá nhân hoá,
kho tài liệu (RAG), Co-Writer, cùng hệ thống gói cước theo tín dụng, kết bạn, chia sẻ Partner và phòng học chung.

## Chạy trên máy (Windows)

Yêu cầu: Python 3.11+ và Node.js 20+.

```bat
pip install -r requirements.txt
cd web && npm install && cd ..
start.bat
```

- Web: http://127.0.0.1:3782 · API: http://127.0.0.1:8001
- Log: thư mục `logs\` · Dừng: `stop.bat`
- `start.bat` bật `BILLING_DEMO_MODE=true` (nút "giả lập thanh toán"); tắt khi chạy thật.
- Tài khoản đăng ký đầu tiên là admin. Cấu hình model/API key tại **Settings → Models**.

Cấu hình tuỳ chọn: xem `.env.example`. Dữ liệu chạy nằm trong `data/`.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `pathmind/` | Backend FastAPI (API, agent, RAG, billing, multi-user) |
| `web/` | Frontend Next.js |
| `scripts/` | Tiện ích runtime (PocketBase, web launcher) |
| `requirements/`, `requirements.txt`, `pyproject.toml` | Phụ thuộc Python |
| `data/` | Dữ liệu người dùng, DB, cấu hình (không commit) |

Chi tiết tính năng, API và việc còn tồn đọng: xem `CLAUDE.md`.

## Giấy phép

PathMind dựa trên dự án mã nguồn mở [DeepTutor](https://github.com/HKUDS/DeepTutor)
của HKUDS, phát hành theo Apache License 2.0 — xem `LICENSE` và `THIRD_PARTY_NOTICES.md`.
