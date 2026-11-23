# Brainstorm: full course teaching every node, easy -> hard

Date: 2026-10-30. Approved: 1a (9 chapters as below), 2a (guided step lessons with checks, same as existing), 3b (no free challenges yet), 4a (capstone "Xưởng đóng gói"), 5a (4 parallel agents by chapter).

Foundation committed eb72cf9:
- app/src/tutorial/course.ts: COURSE chapters; arrangeCourse orders lessons and renumbers titles by course order; chapterOf.
- app/src/tutorial/course-pack-{a,b,c,d}.ts: `createCoursePackX(kit: LessonKit): Lesson[]`, one per agent, all spread into LESSONS.
- Menu grouped by chapter with per-chapter done count. Progress is stored by lesson id, so old progress survives reordering.

| Chapter | Lessons (new = *) |
|---|---|
| Làm quen | walk-jump, collect-stars, win-lose, *secret-door (Khi bắt đầu, Không) |
| Đồ vật | carry-use, hand-tools, ui-chest |
| Bot | make-bot, chores, chores-place, bot-pickaxe, *chase-game (Đuổi/Trốn) |
| Đánh nhau | combat, platforms-shooting |
| Thế giới | chance-zones, camera-portals, *collider-gravity (Nâng cao: vùng va chạm, trọng lực; cảm biến "Tính khi nào"), *conveyor (Băng chuyền) |
| Xe cộ | vehicles, bot-driver, *route-traffic (Chạy theo tuyến + đèn), *train (Bám ray, Đầu máy, Toa, Kéo theo bởi, Đường ray) |
| Giao hàng | *cargo-delivery (Chất/Dỡ hàng theo loại), *guide-arrow (Mũi tên chỉ đường) |
| Số và giao diện | *health-color (Chọn theo số, Đổi khoảng số), *start-screen (Màn hình bắt đầu, Nút trên màn hình), *ask-dialog (Hộp hỏi) |
| Làm game thật | editor-tools, *groups (Nhóm mảnh ghép, Kho game), *capstone-factory |

Packs: A = secret-door, chase-game, collider-gravity, conveyor. B = route-traffic, train, cargo-delivery, guide-arrow. C = health-color, start-screen, ask-dialog. D = groups, capstone-factory.

Acceptance: every one of the 50 node kinds appears in at least one lesson; each new lesson has headless tests (each step's check passes after the expected edit, starter board valid, the finished board plays to its goal where relevant) and a browser walkthrough screenshot; all gates green.
