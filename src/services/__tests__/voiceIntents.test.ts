import { normalizeVietnamese, parseIntent } from '../voiceIntents';

describe('normalizeVietnamese', () => {
  test('strips diacritics and lowercases accented Vietnamese', () => {
    // Arrange
    const input = 'Chụp Ảnh';

    // Act
    const result = normalizeVietnamese(input);

    // Assert
    expect(result).toBe('chup anh');
  });

  test('converts đ and Đ to plain d', () => {
    // Arrange
    const input = 'Đọc lại đi';

    // Act
    const result = normalizeVietnamese(input);

    // Assert
    expect(result).toBe('doc lai di');
  });

  test('trims and collapses internal whitespace', () => {
    // Arrange
    const input = '  chụp   ảnh  ';

    // Act
    const result = normalizeVietnamese(input);

    // Assert
    expect(result).toBe('chup anh');
  });
});

describe('parseIntent', () => {
  test("returns 'capture' for accented transcript 'chụp ảnh'", () => {
    // Arrange
    const transcript = 'chụp ảnh';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('capture');
  });

  test("returns 'capture' for unaccented ASR output 'chup anh'", () => {
    // Arrange
    const transcript = 'chup anh';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('capture');
  });

  test("returns 'repeat' when keyword is embedded in a longer sentence ('làm ơn đọc lại cho tôi')", () => {
    // Arrange
    const transcript = 'làm ơn đọc lại cho tôi';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('repeat');
  });

  test("prioritizes 'stop' over 'capture' when transcript is 'dừng chụp'", () => {
    // Arrange
    const transcript = 'dừng chụp';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('stop');
  });

  test("returns 'obstacle' for accented 'dò đường'", () => {
    // Arrange
    const transcript = 'dò đường';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('obstacle');
  });

  test("returns 'obstacle' for unaccented 'do duong'", () => {
    // Arrange
    const transcript = 'do duong';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('obstacle');
  });

  test("returns 'unknown' for unrelated transcript 'thời tiết hôm nay'", () => {
    // Arrange
    const transcript = 'thời tiết hôm nay';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('unknown');
  });

  test("returns 'unknown' for empty transcript", () => {
    // Arrange
    const transcript = '';

    // Act
    const intent = parseIntent(transcript);

    // Assert
    expect(intent).toBe('unknown');
  });
});
