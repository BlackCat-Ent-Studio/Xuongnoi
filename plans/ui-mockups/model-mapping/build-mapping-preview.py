"""Build the style -> pack-model mapping preview page (index.html) and mapping.json.

Run: python -X utf8 build-mapping-preview.py
"""
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
PACK = HERE.parents[2] / 'app' / 'public' / 'models' / 'mega-pack-world'
THUMBS = '../../../app/public/models/mega-pack-world/'

items = {i['rel'].split('/')[-1][:-4]: i for i in json.loads((PACK / 'manifest.json').read_text('utf8'))['items']}


def pick(pattern, exclude=None):
    return sorted(n for n in items if re.search(pattern, n) and not (exclude and re.search(exclude, n)))


# (group, key, Vietnamese label, uses in city-delivery-3d, how it is placed, model names, note)
ROLES = [
    ('Kiểu dáng khối', 'house', 'Nhà ở', 13, 'fit', pick(r'^(Town|City)_\d+_House_1$'), ''),
    ('Kiểu dáng khối', 'shop', 'Cửa hàng', 8, 'fit',
     pick(r'^Store_\d+_(Pizzeria|Greengrocery_Shop|Pet_Store|Hot_Dog_Shop|Music_Store|Donuts_Shop|Pharmacy|Bar|Beauty_Shop|Snack_Bar'
          r'|Burger_Shop|Restaurant|Bakery|Ice_Cream_Shop|Cafe|Flowers_Shop|Book_Shop|Candy_shop|Toy_Shop)_1$')
     + ['Public_13_Laundry_1', 'Public_15_Hair_Salon_1', 'Public_18_Gym_1'], ''),
    ('Kiểu dáng khối', 'stall', 'Sạp chợ', 6, 'fit',
     ['Farm_3_Warehouse_1', 'Farm_4_Warehouse_1', 'Store_19_Farm_Market_1', 'City_3_Hot_Dog_Car_1', 'Town_20_Summer_Gazebo_1'], ''),
    ('Kiểu dáng khối', 'factory', 'Nhà xưởng', 10, 'fit',
     ['Public_6_Post_Office_1', 'Public_5_Gas_Station_Building_1', 'Public_11_Fire_Station_1', 'Public_10_Shopping_Mall_1',
      'Farm_17_Barn_1', 'Farm_9_Barn_1', 'Farm_19_Farm_Silo_1', 'Farm_2_Mill_1'], ''),
    ('Kiểu dáng khối', 'tree', 'Cây xanh', 20, 'fit', pick(r'_Tree_\d+$', r'Island'), ''),
    ('Kiểu dáng khối', 'lamppost', 'Cột đèn', 17, 'fit',
     ['City_1_Street_Lamp_1', 'City_5_Street_Lamp_1', 'City_13_Street_Lamp_1', 'City_9_Lantern_1', 'Store_1_Street_Lamp_1',
      'Store_4_Street_Lamp_1', 'Town_2_Street_Lamp_1', 'Town_15_Street_Lamp_1'], ''),
    ('Kiểu dáng khối', 'trafficlight', 'Đèn giao thông', 16, 'fit', ['City_7_Traffic_Light_1'],
     'Gắn thêm bóng sáng xanh/vàng/đỏ lên mô hình để vẫn đổi màu khi chơi.'),
    ('Kiểu dáng khối', 'road', 'Mặt đường', 16, 'tile', ['City_7_Roadway_1', 'City_14_Road_1'],
     'Đường của bộ hình màu CAM, không phải xám nhựa. Xếp lặp cho đủ dài. Xem câu hỏi 1 bên dưới.'),
    ('Kiểu dáng khối', 'sidewalk', 'Vỉa hè', 9, 'tile', ['City_8_Base_2'], 'Tấm lát xám, xếp lặp cho đủ dài.'),
    ('Kiểu dáng khối', 'field', 'Ruộng rau', 3, 'tile', ['Farm_4_Garden_1', 'Farm_19_Garden_1', 'Farm_1_Garden_1'], 'Luống đất xếp lặp.'),
    ('Kiểu dáng khối', 'rock', 'Núi đá', 11, 'fit', ['Farm_5_Stone_1', 'Farm_5_Stone_2', 'Farm_20_Stone_2', 'Farm_11_Stone_1'],
     'Bộ hình chỉ có đá cuội nhỏ; phóng to cho vừa khối.'),
    ('Kiểu dáng khối', 'fence', 'Hàng rào', 84, 'tile', ['Farm_6_Fence_1', 'Farm_7_Fence_1', 'Farm_14_Fence_1', 'City_4_Fence_1'],
     'Mỗi hàng rào chọn 1 mẫu, xếp lặp dọc theo chiều dài.'),
    ('Xe', 'car', 'Xe con', 10, 'fit',
     ['City_8_Car_1', 'City_8_Car_2', 'Town_5_Car_1', 'Town_18_Car_1', 'Town_9_Car_1', 'Town_9_Car_2', 'City_7_Taxi_1',
      'Public_5_Car_1', 'Public_16_Police_Car_1', 'City_19_Car_1'], ''),
    ('Xe', 'truck', 'Xe tải', 1, 'fit', ['Public_6_Truck_1', 'Farm_13_Truck_1'],
     'Hàng chất trên thùng xe vẫn do game xếp; có thể phải chỉnh chỗ đặt hàng.'),
    ('Xe', 'bike', 'Xe đạp', 0, 'fit', ['City_6_Bike_1', 'City_6_Bike_2', 'Town_19_Bicycle_1', 'Town_19_Bicycle_2', 'City_14_Scooter_Delivery_1'], ''),
    ('Đồ vật', 'crate', 'Thùng hàng', 14, 'fit', pick(r'^City_14_Parcel_\d$') + ['City_4_Box_1', 'Farm_18_Box_1'], ''),
    ('Đồ vật', 'veggie', 'Rau củ', 12, 'fit',
     ['Farm_1_Carrot_1', 'Farm_1_Pumpkin_1', 'Farm_1_Beet_1', 'Farm_1_Turnip_1', 'Farm_17_Broccoli_1', 'Farm_11_Eggplant_1'], ''),
    ('Đồ vật', 'ore', 'Quặng', 12, 'fit', ['Farm_5_Stone_1', 'Farm_5_Stone_2', 'Farm_20_Stone_2'], 'Đá xám; bộ hình không có quặng lấp lánh.'),
    ('Đồ vật', 'bucket', 'Xô', 1, 'fit', ['Farm_1_Bucket_1'], ''),
    ('Đồ vật', 'ball', 'Bóng', 0, 'fit', ['Store_11_Toy_Ball_1', 'Store_11_Toy_Ball_2'], ''),
    ('Đồ vật', 'key', 'Chìa khóa', 0, 'fit', ['Public_7_Key_2'], 'Chỉ có 1 mẫu, hơi to; game sẽ thu nhỏ cho vừa.'),
]
KEEP_OLD = [
    ('Hộp trơn', 'Không phải hình, là khối màu.'),
    ('Biển tên', 'Biển của bộ hình đã in sẵn chữ tiếng Anh; biển của game phải hiện chữ bạn gõ.'),
    ('Băng chuyền, Đường ray', 'Bộ hình không có.'),
    ('Đầu máy, Toa tàu', 'Bộ hình không có tàu hỏa.'),
    ('Nhân vật: người, robot, khủng long, mèo, gà con…', 'Bộ hình không có người/con vật làm nhân vật.'),
    ('Đồ vật: kiếm, cuốc chim, búa, đuốc, đũa phép, ổ khóa, hộp', 'Bộ hình không có hoặc không giống.'),
]

missing = [n for r in ROLES for n in r[5] if n not in items]
assert not missing, missing

mapping = {r[1]: {'label': r[2], 'place': r[4], 'models': [items[n]['glb'].removeprefix('GLB/') for n in r[5]]} for r in ROLES}
(HERE / 'mapping.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=1), 'utf8')

rows, group = [], None
for g, key, label, uses, place, names, note in ROLES:
    if g != group:
        rows.append(f'<h2>{html.escape(g)}</h2>')
        group = g
    cards = ''.join(
        f'<figure><img src="{THUMBS}{items[n]["thumb"]}" alt="{n}"><figcaption>{n}</figcaption></figure>' for n in names)
    how = 'xếp lặp theo chiều dài' if place == 'tile' else 'thu cho vừa khối, giữ tỉ lệ'
    rows.append(
        f'<section><header><h3>{html.escape(label)} <code>{key}</code></h3>'
        f'<span class="meta">{len(names)} mẫu · {how}' + (f' · thành phố 3D dùng {uses}' if uses else '') + '</span>'
        + (f'<p class="note">{html.escape(note)}</p>' if note else '') + f'</header><div class="grid">{cards}</div></section>')
keep = ''.join(f'<li><b>{html.escape(a)}</b> — {html.escape(b)}</li>' for a, b in KEEP_OLD)

page = f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kiểu dáng → mô hình mới</title><style>
body{{margin:0;font:14px/1.45 system-ui,"Segoe UI",sans-serif;background:#f4f2ee;color:#1d1d1f}}
main{{max-width:1240px;margin:0 auto;padding:20px}}h1{{font-size:22px;margin:0 0 4px}}h2{{margin:28px 0 8px;font-size:17px;border-bottom:2px solid #1d1d1f;padding-bottom:4px}}
section{{background:#fff;border:1px solid #e2dfd8;border-radius:12px;padding:12px 14px;margin:10px 0}}
h3{{display:inline;font-size:16px;margin:0 10px 0 0}}code{{font-size:12px;color:#6b6b70}}.meta{{color:#6b6b70}}
.note{{margin:6px 0 0;color:#a14a00}}.grid{{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}}
figure{{margin:0;width:118px}}figure img{{width:118px;height:118px;border-radius:8px;background:#f2f2f2;display:block}}
figcaption{{font-size:11px;color:#6b6b70;word-break:break-all}}.keep{{background:#fff7e6;border-color:#f0d9a8}}
</style></head><body><main>
<h1>Kiểu dáng cũ → mô hình mới (MEGA PACK WORLD)</h1>
<p>Mỗi ô dưới đây là các mẫu sẽ được dùng. Khi có nhiều mẫu, mỗi khối tự chọn 1 mẫu cố định (giống nhau mọi lần chơi) để phố không bị lặp.
Hình cũ vẽ bằng code của các kiểu này sẽ bị xóa.</p>
{''.join(rows)}
<h2>Giữ hình cũ (bộ hình không có thứ thay thế)</h2><section class="keep"><ul>{keep}</ul></section>
</main></body></html>'''
(HERE / 'index.html').write_text(page, 'utf8')
print('roles', len(ROLES), 'models', sum(len(r[5]) for r in ROLES))
