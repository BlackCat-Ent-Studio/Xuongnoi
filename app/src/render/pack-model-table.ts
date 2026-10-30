import type { BlockStyle } from '../engine/block-styles';
import type { ItemShape, VehicleModel } from '../engine/types';
import type { PackPool } from './pack-models';

/*
 * Which MEGA PACK WORLD models stand in for each look. Paths are relative to PACK_BASE.
 * Several models in a pool = each entity keeps one of them, picked from its owner node id.
 * Pools were chosen by eye on plans/ui-mockups/model-mapping (approved 2026-10-31); models over 20k triangles
 * were then left out so one building cannot cost as much as a whole street.
 */

/** Block looks ("Kiểu dáng") drawn with pack models. Styles not listed keep their code-drawn look. */
export const BLOCK_PACK: Readonly<Partial<Record<BlockStyle, PackPool>>> = {
  // Nhà ở
  house: {
    place: 'footprint',
    models: [
      'Exteriors/City/City_12_House_1.glb',
      'Exteriors/City/City_13_House_1.glb',
      'Exteriors/City/City_14_House_1.glb',
      'Exteriors/City/City_15_House_1.glb',
      'Exteriors/City/City_17_House_1.glb',
      'Exteriors/City/City_18_House_1.glb',
      'Exteriors/City/City_19_House_1.glb',
      'Exteriors/City/City_1_House_1.glb',
      'Exteriors/City/City_4_House_1.glb',
      'Exteriors/City/City_6_House_1.glb',
      'Exteriors/Town/Town_10_House_1.glb',
      'Exteriors/Town/Town_11_House_1.glb',
      'Exteriors/Town/Town_12_House_1.glb',
      'Exteriors/Town/Town_13_House_1.glb',
      'Exteriors/Town/Town_14_House_1.glb',
      'Exteriors/Town/Town_15_House_1.glb',
      'Exteriors/Town/Town_16_House_1.glb',
      'Exteriors/Town/Town_17_House_1.glb',
      'Exteriors/Town/Town_18_House_1.glb',
      'Exteriors/Town/Town_19_House_1.glb',
      'Exteriors/Town/Town_1_House_1.glb',
      'Exteriors/Town/Town_20_House_1.glb',
      'Exteriors/Town/Town_2_House_1.glb',
      'Exteriors/Town/Town_3_House_1.glb',
      'Exteriors/Town/Town_4_House_1.glb',
      'Exteriors/Town/Town_5_House_1.glb',
      'Exteriors/Town/Town_6_House_1.glb',
      'Exteriors/Town/Town_7_House_1.glb',
      'Exteriors/Town/Town_8_House_1.glb',
    ],
  },
  // Cửa hàng
  shop: {
    place: 'footprint',
    models: [
      'Exteriors/Store/Store_10_Greengrocery_Shop_1.glb',
      'Exteriors/Store/Store_12_Hot_Dog_Shop_1.glb',
      'Exteriors/Store/Store_13_Music_Store_1.glb',
      'Exteriors/Store/Store_14_Donuts_Shop_1.glb',
      'Exteriors/Store/Store_15_Pharmacy_1.glb',
      'Exteriors/Store/Store_16_Bar_1.glb',
      'Exteriors/Store/Store_17_Beauty_Shop_1.glb',
      'Exteriors/Store/Store_18_Snack_Bar_1.glb',
      'Exteriors/Store/Store_1_Pizzeria_1.glb',
      'Exteriors/Store/Store_20_Restaurant_1.glb',
      'Exteriors/Store/Store_2_Burger_Shop_1.glb',
      'Exteriors/Store/Store_3_Bakery_1.glb',
      'Exteriors/Store/Store_4_Ice_Cream_Shop_1.glb',
      'Exteriors/Store/Store_5_Cafe_1.glb',
      'Exteriors/Store/Store_6_Flowers_Shop_1.glb',
      'Exteriors/Store/Store_7_Book_Shop_1.glb',
      'Exteriors/Store/Store_9_Toy_Shop_1.glb',
      'Exteriors/Public/Public_13_Laundry_1.glb',
      'Exteriors/Public/Public_15_Hair_Salon_1.glb',
      'Exteriors/Public/Public_18_Gym_1.glb',
    ],
  },
  // Sạp chợ
  stall: {
    place: 'footprint',
    models: [
      'Exteriors/Farm/Farm_3_Warehouse_1.glb',
      'Exteriors/Farm/Farm_4_Warehouse_1.glb',
      'Exteriors/Store/Store_19_Farm_Market_1.glb',
      'Exteriors/City/City_3_Hot_Dog_Car_1.glb',
      'Exteriors/Town/Town_20_Summer_Gazebo_1.glb',
    ],
  },
  // Nhà xưởng
  factory: {
    place: 'footprint',
    models: [
      'Exteriors/Public/Public_6_Post_Office_1.glb',
      'Exteriors/Public/Public_5_Gas_Station_Building_1.glb',
      'Exteriors/Public/Public_11_Fire_Station_1.glb',
      'Exteriors/Public/Public_10_Shopping_Mall_1.glb',
      'Exteriors/Farm/Farm_17_Barn_1.glb',
      'Exteriors/Farm/Farm_9_Barn_1.glb',
      'Exteriors/Farm/Farm_19_Farm_Silo_1.glb',
      'Exteriors/Farm/Farm_2_Mill_1.glb',
    ],
  },
  // Cây xanh
  tree: {
    place: 'stand',
    models: [
      'Exteriors/City/City_10_Tree_1.glb',
      'Exteriors/City/City_10_Tree_2.glb',
      'Exteriors/City/City_10_Tree_3.glb',
      'Exteriors/City/City_11_Tree_1.glb',
      'Exteriors/City/City_11_Tree_2.glb',
      'Exteriors/City/City_12_Tree_1.glb',
      'Exteriors/City/City_17_Tree_1.glb',
      'Exteriors/City/City_17_Tree_2.glb',
      'Exteriors/City/City_17_Tree_3.glb',
      'Exteriors/City/City_17_Tree_4.glb',
      'Exteriors/City/City_1_Tree_1.glb',
      'Exteriors/City/City_1_Tree_2.glb',
      'Exteriors/City/City_1_Tree_3.glb',
      'Exteriors/City/City_2_Tree_1.glb',
      'Exteriors/City/City_2_Tree_2.glb',
      'Exteriors/City/City_3_Tree_1.glb',
      'Exteriors/City/City_6_Tree_1.glb',
      'Exteriors/Farm/Farm_10_Tree_1.glb',
      'Exteriors/Farm/Farm_12_Tree_1.glb',
      'Exteriors/Farm/Farm_13_Tree_1.glb',
      'Exteriors/Farm/Farm_13_Tree_2.glb',
      'Exteriors/Farm/Farm_15_Tree_1.glb',
      'Exteriors/Farm/Farm_16_Tree_1.glb',
      'Exteriors/Farm/Farm_16_Tree_2.glb',
      'Exteriors/Farm/Farm_16_Tree_3.glb',
      'Exteriors/Farm/Farm_20_Tree_1.glb',
      'Exteriors/Farm/Farm_5_Tree_1.glb',
      'Exteriors/Farm/Farm_6_Tree_1.glb',
      'Exteriors/Farm/Farm_6_Tree_2.glb',
      'Exteriors/Farm/Farm_7_Tree_1.glb',
      'Exteriors/Farm/Farm_9_Tree_1.glb',
      'Exteriors/Farm/Farm_9_Tree_2.glb',
      'Exteriors/Public/Public_12_Tree_1.glb',
      'Exteriors/Public/Public_12_Tree_2.glb',
      'Exteriors/Store/Store_10_Tree_1.glb',
      'Exteriors/Store/Store_10_Tree_2.glb',
      'Exteriors/Store/Store_10_Tree_3.glb',
      'Exteriors/Store/Store_2_Tree_1.glb',
      'Exteriors/Store/Store_2_Tree_2.glb',
      'Exteriors/Store/Store_2_Tree_3.glb',
      'Exteriors/Store/Store_3_Tree_1.glb',
      'Exteriors/Town/Town_10_Tree_1.glb',
      'Exteriors/Town/Town_12_Tree_1.glb',
      'Exteriors/Town/Town_12_Tree_2.glb',
      'Exteriors/Town/Town_13_Tree_1.glb',
      'Exteriors/Town/Town_14_Tree_1.glb',
      'Exteriors/Town/Town_14_Tree_2.glb',
      'Exteriors/Town/Town_17_Tree_1.glb',
      'Exteriors/Town/Town_17_Tree_2.glb',
      'Exteriors/Town/Town_20_Tree_1.glb',
      'Exteriors/Town/Town_2_Tree_1.glb',
      'Exteriors/Town/Town_3_Tree_1.glb',
      'Exteriors/Town/Town_3_Tree_2.glb',
      'Exteriors/Town/Town_4_Tree_1.glb',
      'Exteriors/Town/Town_4_Tree_2.glb',
      'Exteriors/Town/Town_6_Tree_1.glb',
      'Exteriors/Town/Town_6_Tree_2.glb',
      'Exteriors/Town/Town_7_Tree_1.glb',
      'Exteriors/Town/Town_8_Tree_1.glb',
      'Exteriors/Town/Town_9_Tree_1.glb',
    ],
  },
  // Cột đèn
  lamppost: {
    place: 'stand',
    models: [
      'Exteriors/City/City_1_Street_Lamp_1.glb',
      'Exteriors/City/City_5_Street_Lamp_1.glb',
      'Exteriors/City/City_13_Street_Lamp_1.glb',
      'Exteriors/City/City_9_Lantern_1.glb',
      'Exteriors/Store/Store_1_Street_Lamp_1.glb',
      'Exteriors/Store/Store_4_Street_Lamp_1.glb',
      'Exteriors/Town/Town_2_Street_Lamp_1.glb',
      'Exteriors/Town/Town_15_Street_Lamp_1.glb',
    ],
  },
  // Đèn giao thông
  trafficlight: {
    place: 'stand',
    models: [
      'Exteriors/City/City_7_Traffic_Light_1.glb',
    ],
  },
  // Mặt đường
  road: {
    place: 'tile',
    models: [
      'Exteriors/City/City_7_Roadway_1.glb',
      'Exteriors/City/City_14_Road_1.glb',
    ],
  },
  // Vỉa hè
  sidewalk: {
    place: 'tile',
    tile: 3,
    models: [
      'Exteriors/City/City_8_Base_2.glb',
    ],
  },
  // Ruộng rau
  field: {
    place: 'tile',
    tile: 1.8,
    models: [
      'Exteriors/Farm/Farm_4_Garden_1.glb',
      'Exteriors/Farm/Farm_19_Garden_1.glb',
      'Exteriors/Farm/Farm_1_Garden_1.glb',
    ],
  },
  // Núi đá
  rock: {
    place: 'inside',
    models: [
      'Exteriors/Farm/Farm_5_Stone_1.glb',
      'Exteriors/Farm/Farm_5_Stone_2.glb',
      'Exteriors/Farm/Farm_20_Stone_2.glb',
      'Exteriors/Farm/Farm_11_Stone_1.glb',
    ],
  },
  // Hàng rào
  fence: {
    place: 'tile',
    models: [
      'Exteriors/Farm/Farm_6_Fence_1.glb',
      'Exteriors/Farm/Farm_7_Fence_1.glb',
    ],
  },
};

/** Vehicle models drawn with pack models. Trains keep their code-drawn look. */
export const VEHICLE_PACK: Readonly<Partial<Record<VehicleModel, PackPool>>> = {
  // Xe con
  car: {
    place: 'footprint',
    models: [
      'Exteriors/City/City_8_Car_1.glb',
      'Exteriors/City/City_8_Car_2.glb',
      'Exteriors/Town/Town_5_Car_1.glb',
      'Exteriors/Town/Town_18_Car_1.glb',
      'Exteriors/Town/Town_9_Car_1.glb',
      'Exteriors/Town/Town_9_Car_2.glb',
      'Exteriors/City/City_7_Taxi_1.glb',
      'Exteriors/Public/Public_5_Car_1.glb',
      'Exteriors/Public/Public_16_Police_Car_1.glb',
      'Exteriors/City/City_19_Car_1.glb',
    ],
  },
  // Xe tải
  truck: {
    place: 'footprint',
    models: [
      'Exteriors/Public/Public_6_Truck_1.glb',
      'Exteriors/Farm/Farm_13_Truck_1.glb',
    ],
  },
  // Xe đạp
  bike: {
    place: 'footprint',
    models: [
      'Exteriors/City/City_6_Bike_1.glb',
      'Exteriors/City/City_6_Bike_2.glb',
      'Exteriors/Town/Town_19_Bicycle_1.glb',
      'Exteriors/Town/Town_19_Bicycle_2.glb',
      'Exteriors/City/City_14_Scooter_Delivery_1.glb',
    ],
  },
};

/** Item shapes drawn with pack models. Tools and other shapes keep their code-drawn look. */
export const ITEM_PACK: Readonly<Partial<Record<ItemShape, PackPool>>> = {
  // Thùng hàng
  crate: {
    place: 'inside',
    models: [
      'Exteriors/City/City_14_Parcel_1.glb',
      'Exteriors/City/City_14_Parcel_2.glb',
      'Exteriors/City/City_14_Parcel_3.glb',
      'Exteriors/City/City_14_Parcel_4.glb',
      'Exteriors/City/City_14_Parcel_5.glb',
      'Exteriors/City/City_4_Box_1.glb',
      'Exteriors/Farm/Farm_18_Box_1.glb',
    ],
  },
  // Rau củ
  veggie: {
    place: 'inside',
    models: [
      'Exteriors/Farm/Farm_1_Carrot_1.glb',
      'Exteriors/Farm/Farm_1_Pumpkin_1.glb',
      'Exteriors/Farm/Farm_1_Beet_1.glb',
      'Exteriors/Farm/Farm_1_Turnip_1.glb',
      'Exteriors/Farm/Farm_17_Broccoli_1.glb',
      'Exteriors/Farm/Farm_11_Eggplant_1.glb',
    ],
  },
  // Quặng
  ore: {
    place: 'inside',
    models: [
      'Exteriors/Farm/Farm_5_Stone_1.glb',
      'Exteriors/Farm/Farm_5_Stone_2.glb',
      'Exteriors/Farm/Farm_20_Stone_2.glb',
    ],
  },
  // Xô
  bucket: {
    place: 'inside',
    models: [
      'Exteriors/Farm/Farm_1_Bucket_1.glb',
    ],
  },
  // Bóng
  ball: {
    place: 'inside',
    models: [
      'Exteriors/Store/Store_11_Toy_Ball_1.glb',
      'Exteriors/Store/Store_11_Toy_Ball_2.glb',
    ],
  },
  // Chìa khóa
  key: {
    place: 'inside',
    models: [
      'Exteriors/Public/Public_7_Key_2.glb',
    ],
  },
};
