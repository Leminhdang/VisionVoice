// Làm mượt mức cảnh báo theo thời gian — pure, không React, không Expo.
//
// assessDetections() chấm từng khung riêng lẻ, mà model dò vật dao động từng
// khung. Module này đứng giữa kết quả thô và phần còn lại của app (màn hình,
// giọng nói): lên mức cần đủ khung xác nhận, xuống mức phải vắng đủ lâu.

import { OBSTACLE_CONFIRM_FRAMES, OBSTACLE_SEVERITY_HOLD_MS } from '../constants/config';
import type { Assessment } from './obstacleDetector';

export interface SeveritySmoother {
  update(raw: Assessment, now: number): Assessment;
}

const SAFE_ASSESSMENT: Assessment = { severity: 'safe', label: null, areaRatio: 0 };

interface Sighting {
  at: number;
  assessment: Assessment;
}

/**
 * Bộ làm mượt có trạng thái (đóng trong closure), tạo mới mỗi lần vào chế độ.
 *
 * - Lên mức: một khung hazard chỉ được ghi nhận khi đã có
 *   OBSTACLE_CONFIRM_FRAMES khung hazard liên tiếp. Đếm theo có/không có vật
 *   cản chứ không theo từng mức, nên warning/danger xen kẽ vẫn tích luỹ được.
 * - Xuống mức: kết quả là mức cao nhất đã ghi nhận trong
 *   OBSTACLE_SEVERITY_HOLD_MS gần nhất. Vật mất một hai khung thì mức vẫn giữ;
 *   vắng hẳn đủ lâu mới về safe.
 * - Đang giữ một mức thì khung hazard không cao hơn mức đó gia hạn ngay, không
 *   cần đếm lại: vật đã được xác nhận rồi, chỉ là vừa mất một khung. Thiếu điều
 *   này thì khung đầu tiên sau chỗ mất bị coi là "chưa xác nhận" và mức hết hạn
 *   đúng lúc vật quay lại. Leo lên mức cao hơn vẫn phải đủ khung xác nhận.
 * - Kết quả lặp lại đúng khung đã ghi nhận gần nhất ở mức đó, để nhãn và diện
 *   tích đi cùng mức chứ không lấy từ khung trống.
 */
export function createSeveritySmoother(): SeveritySmoother {
  let hazardStreak = 0;
  let lastDanger: Sighting | null = null;
  let lastWarning: Sighting | null = null;

  const isFresh = (sighting: Sighting | null, now: number): sighting is Sighting =>
    sighting !== null && now - sighting.at < OBSTACLE_SEVERITY_HOLD_MS;

  return {
    update(raw: Assessment, now: number): Assessment {
      if (raw.severity === 'safe') {
        hazardStreak = 0;
      } else {
        hazardStreak++;
        if (hazardStreak >= OBSTACLE_CONFIRM_FRAMES) {
          const sighting = { at: now, assessment: raw };
          if (raw.severity === 'danger') {
            lastDanger = sighting;
          } else {
            lastWarning = sighting;
          }
        } else if (isFresh(lastDanger, now)) {
          lastDanger = { at: now, assessment: lastDanger.assessment };
        } else if (isFresh(lastWarning, now)) {
          // Khung danger chưa xác nhận vẫn chứng tỏ vật còn đó — gia hạn warning,
          // nhưng không leo thang.
          lastWarning = { at: now, assessment: lastWarning.assessment };
        }
      }

      if (isFresh(lastDanger, now)) {
        return lastDanger.assessment;
      }
      if (isFresh(lastWarning, now)) {
        return lastWarning.assessment;
      }
      return SAFE_ASSESSMENT;
    },
  };
}
