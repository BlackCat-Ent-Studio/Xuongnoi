/**
 * The "factory" looks of simulated pieces ("Kiểu dáng" on the robot chassis, the arm pieces and loose items). A look only
 * changes how a piece is drawn: its collision box, mass and behaviour are the piece's own. Every piece starts on its
 * classic look, and only a piece that was switched to another one carries a `look` on its entity, so a board saved
 * before these looks existed is drawn exactly as it was.
 */

export interface LookOption {
  value: string;
  label: string;
}

/** The look every piece has unless it was switched: nothing is written on the entity. */
export const CLASSIC_LOOK = 'classic';

/** Robot chassis: the rounded AGV (body, wheels with fenders, light strip). */
export const AGV_LOOK = 'agv';
export const ROBOT_LOOKS: readonly LookOption[] = [
  { value: CLASSIC_LOOK, label: 'Kiểu cũ (thân hộp, bánh mâm vàng)' },
  { value: AGV_LOOK, label: 'Xe AGV bo tròn (vè bánh, dải đèn quanh thân)' },
];

/** Links, joints and grippers: the tidy factory arm; a link with a width is drawn as the AGV tray. */
export const FACTORY_ARM_LOOK = 'factory';
export const ARM_LOOKS: readonly LookOption[] = [
  { value: CLASSIC_LOOK, label: 'Kiểu cũ' },
  { value: FACTORY_ARM_LOOK, label: 'Tay máy xưởng (gọn, đầu tròn; thanh có bề rộng vẽ thành khay xe AGV)' },
];

/** Joints only: a slim hinge pin, for the joint under a tray. */
export const HINGE_LOOK = 'hinge';
export const JOINT_LOOKS: readonly LookOption[] = [...ARM_LOOKS, { value: HINGE_LOOK, label: 'Bản lề nhỏ (khớp lật khay xe AGV)' }];

/** Loose items: a carton or one of the parcel models, laid into the item's real size. */
export const PARCEL_LOOK_PREFIX = 'parcel-';
export const PARCEL_LOOKS: readonly LookOption[] = [
  { value: CLASSIC_LOOK, label: 'Theo "Hình dạng"' },
  { value: 'parcel-carton', label: 'Thùng carton (băng keo theo màu của vật)' },
  { value: 'parcel-1', label: 'Kiện hàng 1 (xanh ngọc, nơ tím)' },
  { value: 'parcel-2', label: 'Kiện hàng 2 (đỏ)' },
  { value: 'parcel-3', label: 'Kiện hàng 3 (xanh lá)' },
  { value: 'parcel-4', label: 'Kiện hàng 4 (xanh ngọc, băng hồng)' },
  { value: 'parcel-5', label: 'Kiện hàng 5 (vàng)' },
  { value: 'parcel-box', label: 'Thùng gỗ' },
  { value: 'parcel-mix', label: 'Kiện hàng ngẫu nhiên (mỗi kiện một kiểu)' },
];

/** What a piece puts on its entity for the chosen option: nothing for the classic look or an unknown value. */
export function lookSpec(raw: unknown, options: readonly LookOption[]): { look?: string } {
  return typeof raw === 'string' && raw !== CLASSIC_LOOK && options.some((o) => o.value === raw) ? { look: raw } : {};
}
