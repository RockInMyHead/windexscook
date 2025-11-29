/**
 * Demo test to show that the testing infrastructure works
 */

describe('Demo Test Suite', () => {
  test('should pass basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
    expect('hello').toContain('ell');
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  test('should work with objects', () => {
    const obj = { name: 'AI Chef', version: '1.0' };
    expect(obj).toHaveProperty('name');
    expect(obj.name).toBe('AI Chef');
  });

  test('should handle arrays', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr).toContain(3);
    expect(arr[0]).toBe(1);
  });
});
