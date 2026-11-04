/** Vietnamese texts of the lesson "Xem dây chạy từng bước" (the course numbers the title). */

export const STEP_RUN_TEXT = {
  title: 'Xem dây chạy từng bước',
  summary: 'Cho game tự dừng mỗi khi một mảnh làm việc, để thấy dây nào vừa chạy. Học nút "Từng bước".',
  boardName: 'Xem dây chạy từng bước',
  intro: {
    title: 'Bot đi tuần và đếm',
    text: 'Bảng này có sẵn một bot đi qua đi lại. Mỗi lần bot tới một đầu đường, mảnh "Đi tuần" báo một tiếng, và mảnh "Bộ đếm" cộng thêm 1.',
    explain: 'Game chạy rất nhanh nên mắt khó thấy dây nào vừa làm việc. Nút "Từng bước" giúp bạn xem chậm lại.',
  },
  play: {
    title: 'Bấm Chơi',
    text: 'Bấm nút "Chơi" để bot bắt đầu đi.',
  },
  step: {
    title: 'Bấm Từng bước',
    text: 'Bấm nút "🐢 Từng bước" trên thanh trên cùng.',
    explain: 'Từ giờ, game sẽ tự dừng đúng lúc một mảnh có dây nối ra vừa báo "Có".',
  },
  wait: {
    title: 'Game đã dừng',
    text: 'Chờ một chút, game sẽ tự dừng. Nhìn bảng: chấm nhấp nháy là cổng vừa báo, dây sáng là dây vừa chạy, các mảnh khác mờ đi.',
    explain: 'Mảnh nào sáng lên thì mảnh đó vừa làm việc. Nhân vật sáng trên màn chơi là người được mảnh đó điều khiển.',
  },
  next: {
    title: 'Bấm Tiếp',
    text: 'Bấm nút "▶ Tiếp" để game chạy tiếp tới lần dừng kế.',
    explain: 'Mỗi lần bấm, bạn thấy thêm một bước. Bấm Dừng bất cứ lúc nào để quay về chỉnh sửa.',
  },
  done: {
    title: 'Xong rồi',
    text: 'Bạn đã biết xem dây chạy từng bước. Khi game không chạy như ý, hãy dùng nút này để tìm xem dây nào chưa chạy. Bấm Dừng để chỉnh lại.',
  },
} as const;
