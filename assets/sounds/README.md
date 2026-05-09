# Âm thanh chụp ảnh (Shutter Sound)

File `shutter.mp3` cần được đặt trong thư mục này.

## Cách lấy file:
1. Tải một file âm thanh chụp ảnh miễn phí từ:
   - https://freesound.org/search/?q=camera+shutter
   - https://mixkit.co/free-sound-effects/camera/
2. Đặt tên file là `shutter.mp3`
3. Copy vào thư mục `assets/sounds/`

## Không có file thì sao?
App vẫn hoạt động bình thường – phần phát âm thanh được bọc trong try/catch
và sẽ bỏ qua nếu không tìm thấy file (xem `playCameraSound` trong CameraScreen.tsx).
