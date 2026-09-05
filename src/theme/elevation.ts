import { colors } from './colors';

// Nền app gần như đen (#07070E) nên shadow đen vô hình. Dùng quầng sáng màu
// accent để nút chính tự nổi lên khỏi mặt phẳng — vừa là ngôn ngữ độ nổi nhất
// quán, vừa giúp người nhìn kém tìm ra hành động chính mà không phải đọc chữ.
export const elevation = {
  /** Nút hành động chính (BigActionButton variant primary). */
  primary: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  /** Nút chụp — điểm neo thị giác của màn hình máy ảnh. */
  hero: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;
