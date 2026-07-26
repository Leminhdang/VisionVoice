// lineHeight luôn ≥1.18× fontSize vì dấu tiếng Việt chồng lên nhau (ắ ệ ỡ);
// không viết hoa toàn bộ nhãn nút; sàn tuyệt đối fontSize 16.
export const typography = {
  hero: { fontSize: 64, lineHeight: 76, fontWeight: '900' },
  display: { fontSize: 40, lineHeight: 50, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 38, fontWeight: '700' },
  bodyLarge: { fontSize: 22, lineHeight: 34, fontWeight: '500' },
  body: { fontSize: 18, lineHeight: 28, fontWeight: '500' },
  label: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: 0.5 },
  caption: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
} as const;
