# Brainstorm — Xưởng Bot hoàn chỉnh kiểu A (2026-11-01 20:35)

## Quyết định (user)
- Style A = giao diện chính thức. B, C cất kho: code giữ, không tải, xem lại bằng `?theme=b|c` (dev). Bỏ nút A·B·C.
- Vòng chơi đầy đủ: Màn mở đầu → Bản đồ chọn màn → Màn chơi → Thắng (pháo giấy, sao, "Màn tiếp") → hết 8 màn → màn kết thúc.
- 1a: đạo cụ sân chơi vẽ bằng code kiểu gỗ ấm (cửa gỗ, nút đỏ, cờ, đèn, thùng, sao, sàn gỗ/tường xưởng), không dùng MEGA PACK.
- 2b: sân chơi làm BẢN XEM THỬ riêng trước, user duyệt rồi mới đưa vào game.
- 3a: âm thanh tự tạo bằng code (WebAudio): tiếng bấm, nối dây, chạy, thắng, thua + nhạc nền nhẹ; bật/tắt trong Cài đặt.
- 4a: "?" bấm lặp cùng một bước chỉ tính 1 lần.
- 5a: màn 7 bắt buộc nối dây cầu mới thắng.
- Mới: màn 5 (3D đầu tiên) có hướng dẫn bắt buộc lần đầu, như màn 1.
- Tên app: tạm "Xưởng Bot".

## Ngoài phạm vi
APK (D), màn mới, đổi thẻ mảnh ghép / dây / nhân vật / luật màn (trừ màn 7).

## Chia việc
- Hợp đồng chung (controller, commit trước): `puzzle/ui/settings.ts` (nhạc/tiếng on-off, localStorage) + `puzzle/ui/sound.ts` (API playSfx/startMusic/stopMusic, stub).
- Agent P (xem thử sân chơi, không worktree): `plans/ui-mockups/cozy-stage/`.
- Agent S (màn hình): title, bản đồ, cài đặt, chuyển cảnh, pháo giấy, màn kết thúc, cất B/C.
- Agent M (âm thanh): thân `sound.ts` + nhạc.
- Agent G (luật): đếm hint theo bước, màn 7, hướng dẫn màn 5.
- Sau khi user duyệt P: agent đưa sân chơi vào game (render props + scene của 8 màn), giữ luật, chạy lại test lời giải.

## Xong khi
- Chơi trọn vòng từ màn mở đầu tới màn kết thúc.
- 8 màn không còn dải cỏ xanh / sàn xám (sau bước sân chơi).
- Nhân vật nhìn rõ desktop + 844x390.
- Test lời giải 8 màn xanh; ảnh chụp 8 màn x 2 cỡ màn hình đã xem.

## Rủi ro
- Đổi đạo cụ có thể đổi va chạm → chạy lại test headless mọi màn.
- level-screen.ts bị S và G cùng sửa (vùng khác nhau) → merge tay.
- Âm thanh tự tạo đơn giản, không phải nhạc thu.
