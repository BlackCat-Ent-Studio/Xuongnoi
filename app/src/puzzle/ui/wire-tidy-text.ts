/** Words of the wire-tidy tools on the puzzle board. */
export const TIDY_TEXT = {
  tidy: 'Sắp xếp gọn',
  tidyHint: 'Tự xếp các thẻ từ trái sang phải theo đường đi của tín hiệu',
  gom: 'Gom dây',
  gomHint: 'Mỗi nguồn nối tới 3 dây trở lên: gom thành một đường chung rồi mới tỏa ra',
  fit: 'Vừa khung',
  fitAria: 'Thu phóng cho thấy cả bảng',
  tidied: 'Đã xếp gọn! Kéo nền để di chuyển, lăn chuột hoặc chụm hai ngón để thu phóng.',
  gomNone: 'Chưa có nguồn nào nối tới 3 dây trở lên',
  gomDone: (n: number): string => `Đã gom dây của ${n} nguồn`,
  knotAdded: 'Đã thêm nút bẻ dây. Kéo nút để bẻ, chạm đôi vào nút để bỏ.',
  knotMerged: 'Đã gom hai dây vào một nút',
  knotSameSource: 'Chỉ gom được những dây cùng xuất phát từ một chân',
} as const;
