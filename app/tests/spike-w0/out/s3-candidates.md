node kinds 71, params 423, by kind {"number":189,"vec3":85,"color":29,"select":95,"text":24,"key":1}, vec3 85, kinds without params 7: and angle-diff next-free-slot not on-start or ui-pick

| kind | param | kind | default | label |
|---|---|---|---|---|
| ahead-sensor | lookAngle | number | 0 | Xoay hướng nhìn (độ; âm = sang trái, dương = sang phải) |
| block | position | vec3 | 0,0,0 | Vị trí |
| block | size | vec3 | 1,1,1 | Kích thước |
| block | colliderSize | vec3 | 0,0,0 | Cỡ vùng va chạm (0 = bằng kích thước) |
| block | colliderOffset | vec3 | 0,0,0 | Lệch vùng va chạm |
| camera | point | vec3 | 0,0,0 | Điểm nhìn / Lệch so với vật |
| cargo | capacity | number | 4 | Sức chứa (số món) |
| carry | throwLift | number | 0.5 | Độ ném hướng lên (0 = ném thẳng) |
| character | position | vec3 | 0,1,0 | Vị trí xuất hiện |
| character | speed | number | 5 | Tốc độ chạy |
| character | jumpPower | number | 10 | Sức nhảy |
| character | colliderSize | vec3 | 0,0,0 | Cỡ vùng va chạm (0 = bằng kích thước) |
| character | colliderOffset | vec3 | 0,0,0 | Lệch vùng va chạm |
| counter | target | number | 5 | Mục tiêu |
| go-to | targetPos | vec3 | 0,1,0 | Vị trí đến (khi không nối Điểm đến) |
| go-to | stopDistance | number | 0.5 | Dừng cách đích |
| item | position | vec3 | 0,1,0 | Vị trí |
| item | size | vec3 | 0.6,0.6,0.6 | Kích thước |
| item | colliderSize | vec3 | 0,0,0 | Cỡ vùng va chạm (0 = bằng kích thước) |
| item | colliderOffset | vec3 | 0,0,0 | Lệch vùng va chạm |
| joint | start | number | 0 | Góc bắt đầu (độ) |
| joint | min | number | -90 | Góc nhỏ nhất (độ) |
| joint | max | number | 90 | Góc lớn nhất (độ) |
| joint | mount | vec3 | 0,0,0 | Lệch so với vật gắn (dọc / lên / ngang, m) |
| line-track | center | vec3 | 0,0.5,0 | Tâm (x, z; y = độ cao mặt sàn, m) |
| line-track | count | number | 4 | Số điểm (dạng "Tự vẽ") |
| line-track | radius | number | 1 | Bán kính bo góc (m) |
| line-track | p1 | vec3 | -4,0,-3 | Điểm 1 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p2 | vec3 | 4,0,-3 | Điểm 2 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p3 | vec3 | 4,0,3 | Điểm 3 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p4 | vec3 | -4,0,3 | Điểm 4 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p5 | vec3 | 0,0,0 | Điểm 5 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p6 | vec3 | 0,0,0 | Điểm 6 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p7 | vec3 | 0,0,0 | Điểm 7 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p8 | vec3 | 0,0,0 | Điểm 8 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p9 | vec3 | 0,0,0 | Điểm 9 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p10 | vec3 | 0,0,0 | Điểm 10 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p11 | vec3 | 0,0,0 | Điểm 11 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p12 | vec3 | 0,0,0 | Điểm 12 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p13 | vec3 | 0,0,0 | Điểm 13 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p14 | vec3 | 0,0,0 | Điểm 14 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p15 | vec3 | 0,0,0 | Điểm 15 (chỉ dùng x và z; dạng "Tự vẽ") |
| line-track | p16 | vec3 | 0,0,0 | Điểm 16 (chỉ dùng x và z; dạng "Tự vẽ") |
| linear-actuator | position | vec3 | 0,0.3,0 | Vị trí (khi chưa gắn vào vật nào) |
| linear-actuator | direction | number | 0 | Hướng đẩy (độ, trên mặt phẳng nằm) |
| linear-actuator | mount | vec3 | 0,0,0 | Lệch so với vật gắn (dọc / lên / ngang, m) |
| map-range | inMax | number | 1 | Thang cũ: đến |
| map-range | outMax | number | 100 | Thang mới: đến |
| motor | side | number | 0.4 | Vị trí ngang trên thân (m, âm = bên trái, dương = bên phải) |
| motor | forward | number | 0 | Vị trí dọc trên thân (m, dương = phía trước) |
| moving-platform | position | vec3 | 0,0,0 | Điểm A (xuất phát) |
| moving-platform | to | vec3 | 4,0,0 | Điểm B |
| moving-platform | size | vec3 | 3,0.5,1 | Kích thước |
| patrol | pointA | vec3 | -3,1,0 | Điểm A |
| patrol | pointB | vec3 | 3,1,0 | Điểm B |
| pid | target | number | 0 | Giá trị đặt (khi không nối dây) |
| pid | outMax | number | 1 | Điều khiển lớn nhất |
| portal | position | vec3 | 0,1,0 | Vị trí |
| portal | size | vec3 | 1.2,2,1.2 | Kích thước |
| random | max | number | 6 | Lớn nhất |
| robot-body | position | vec3 | 0,0.5,0 | Vị trí xuất hiện |
| robot-body | heading | number | 0 | Hướng mũi lúc đầu (độ, 0 = sang phải, 90 = xuống dưới) |
| robot-body | colliderSize | vec3 | 0,0,0 | Cỡ vùng va chạm (0 = bằng kích thước) |
| robot-body | colliderOffset | vec3 | 0,0,0 | Lệch vùng va chạm |
| rotating-platform | position | vec3 | 0,2,0 | Vị trí (tâm) |
| rotating-platform | size | vec3 | 3,0.5,1 | Kích thước |
| rotating-platform | every | number | 0 | Tự xoay sau (giây, 0 = chỉ khi bật "Xoay") |
| route-follow | count | number | 4 | Số điểm (2 đến 32) |
| route-follow | p1 | vec3 | -6,0.5,-6 | Điểm 1 |
| route-follow | p2 | vec3 | 6,0.5,-6 | Điểm 2 |
| route-follow | p3 | vec3 | 6,0.5,6 | Điểm 3 |
| route-follow | p4 | vec3 | -6,0.5,6 | Điểm 4 |
| route-follow | p5 | vec3 | 0,0.5,0 | Điểm 5 |
| route-follow | p6 | vec3 | 0,0.5,0 | Điểm 6 |
| route-follow | p7 | vec3 | 0,0.5,0 | Điểm 7 |
| route-follow | p8 | vec3 | 0,0.5,0 | Điểm 8 |
| route-follow | p9 | vec3 | 0,0.5,0 | Điểm 9 |
| route-follow | p10 | vec3 | 0,0.5,0 | Điểm 10 |
| route-follow | p11 | vec3 | 0,0.5,0 | Điểm 11 |
| route-follow | p12 | vec3 | 0,0.5,0 | Điểm 12 |
| route-follow | p13 | vec3 | 0,0.5,0 | Điểm 13 |
| route-follow | p14 | vec3 | 0,0.5,0 | Điểm 14 |
| route-follow | p15 | vec3 | 0,0.5,0 | Điểm 15 |
| route-follow | p16 | vec3 | 0,0.5,0 | Điểm 16 |
| route-follow | p17 | vec3 | 0,0.5,0 | Điểm 17 |
| route-follow | p18 | vec3 | 0,0.5,0 | Điểm 18 |
| route-follow | p19 | vec3 | 0,0.5,0 | Điểm 19 |
| route-follow | p20 | vec3 | 0,0.5,0 | Điểm 20 |
| route-follow | p21 | vec3 | 0,0.5,0 | Điểm 21 |
| route-follow | p22 | vec3 | 0,0.5,0 | Điểm 22 |
| route-follow | p23 | vec3 | 0,0.5,0 | Điểm 23 |
| route-follow | p24 | vec3 | 0,0.5,0 | Điểm 24 |
| route-follow | p25 | vec3 | 0,0.5,0 | Điểm 25 |
| route-follow | p26 | vec3 | 0,0.5,0 | Điểm 26 |
| route-follow | p27 | vec3 | 0,0.5,0 | Điểm 27 |
| route-follow | p28 | vec3 | 0,0.5,0 | Điểm 28 |
| route-follow | p29 | vec3 | 0,0.5,0 | Điểm 29 |
| route-follow | p30 | vec3 | 0,0.5,0 | Điểm 30 |
| route-follow | p31 | vec3 | 0,0.5,0 | Điểm 31 |
| route-follow | p32 | vec3 | 0,0.5,0 | Điểm 32 |
| route-follow | arriveRadius | number | 0 | Bán kính tới điểm (0 = tự chọn: xe rộng hơn người) |
| route-follow | railCorner | number | 1.5 | Độ bo góc khi bám ray (0 = góc nhọn) |
| route-follow | stopFor | number | 0 | Dừng ở mỗi điểm (giây, 0 = không dừng; chỉ khi chạy kiểu "Lái tới từng điểm") |
| route-follow | slowRadius | number | 0.6 | Giảm tốc khi gần điểm (đơn vị, chỉ khi chạy từng chặng) |
| signal-plot | max | number | 10 | Lớn nhất (khi không tự chỉnh) |
| signal-plot | width | number | 260 | Rộng (điểm ảnh) |
| signal-plot | height | number | 150 | Cao (điểm ảnh) |
| spawner | position | vec3 | 0,5,0 | Vị trí / lệch so với "Tại đối tượng" |
| spawner | size | vec3 | 0.7,0.7,0.7 | Kích thước |
| teleport | position | vec3 | 0,1,0 | Vị trí đến (khi không nối Điểm đến) |
| timer | seconds | number | 30 | Số giây |
| ui-meter | max | number | 100 | Lớn nhất |
| vehicle | position | vec3 | 0,0.5,0 | Vị trí xuất hiện |
| vehicle | towDistance | number | 0 | Khoảng cách toa (tâm tới tâm với xe kéo; 0 = tự tính từ độ dài hai xe + khe nhỏ) |
| vehicle | colliderSize | vec3 | 0,0,0 | Cỡ vùng va chạm (0 = bằng kích thước) |
| vehicle | colliderOffset | vec3 | 0,0,0 | Lệch vùng va chạm |
| vision-sensor | angle | number | 90 | Góc nhìn (độ) |
| zone | center | vec3 | 0,1,0 | Tâm vùng |
| zone | size | vec3 | 4,3,4 | Kích thước vùng |
