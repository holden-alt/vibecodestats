import { describe, it, expect } from 'vitest';
import { detectInAppBrowser, detectPlatform } from '@/lib/auth/in-app-browser';

describe('detectInAppBrowser', () => {
  it('detects Twitter for iPhone', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E261 Twitter for iPhone/11.92';
    expect(detectInAppBrowser(ua)).toEqual({ id: 'twitter', label: 'X (Twitter)' });
  });

  it('detects Twitter for Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 TwitterAndroid';
    expect(detectInAppBrowser(ua)).toEqual({ id: 'twitter', label: 'X (Twitter)' });
  });

  it('detects Facebook iOS app via FBAN', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0]';
    expect(detectInAppBrowser(ua)?.id).toBe('facebook');
  });

  it('detects Instagram', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 290.0.0.18';
    expect(detectInAppBrowser(ua)?.id).toBe('instagram');
  });

  it('detects LinkedIn', () => {
    const ua = 'Mozilla/5.0 LinkedInApp/1.0';
    expect(detectInAppBrowser(ua)?.id).toBe('linkedin');
  });

  it('detects TikTok via BytedanceWebview', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) BytedanceWebview/1.0';
    expect(detectInAppBrowser(ua)?.id).toBe('tiktok');
  });

  it('returns null for regular Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it('returns null for desktop Chrome', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it('returns null for Chrome iOS (CriOS — real browser app)', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/148.0 Mobile/15E148 Safari/604.1';
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it('returns null for empty/missing UA', () => {
    expect(detectInAppBrowser(null)).toBeNull();
    expect(detectInAppBrowser(undefined)).toBeNull();
    expect(detectInAppBrowser('')).toBeNull();
  });
});

describe('detectPlatform', () => {
  it('detects iOS', () => {
    expect(detectPlatform('iPhone')).toBe('ios');
    expect(detectPlatform('iPad')).toBe('ios');
  });
  it('detects Android', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 13)')).toBe('android');
  });
  it('returns other for desktop', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('other');
  });
  it('returns other for null/undefined', () => {
    expect(detectPlatform(null)).toBe('other');
  });
});
