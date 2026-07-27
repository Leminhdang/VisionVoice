/**
 * Expo config plugin: ép version ML Kit tương thích GoogleUtilities 8.x
 * (Firebase 12.10 cần ~>8.0, MLKitCommon cũ pin ~>6.0).
 *
 * Thêm pod declarations VÀO Podfile khi prebuild, nên sống sót qua
 * `npx expo prebuild --clean`.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ML_KIT_PODS = `
  # [withMLKitVersionFix] Ép version ML Kit tương thích GoogleUtilities 8.x
  pod 'GoogleUtilities', '~> 8.0'
  pod 'MLKitCommon', '~> 14.0'
  pod 'MLKitVision', '~> 10.0'
  pod 'GoogleMLKit/ObjectDetection', '~> 9.0'
  pod 'GoogleMLKit/ObjectDetectionCustom', '~> 9.0'`;

function withMLKitVersionFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Chèn pod declarations ngay sau "target '...' do"
      podfile = podfile.replace(
        /(target\s+'[^']+'\s+do\n)/,
        `$1${ML_KIT_PODS}\n`,
      );

      fs.writeFileSync(podfilePath, podfile, 'utf8');
      return cfg;
    },
  ]);
}

module.exports = withMLKitVersionFix;
