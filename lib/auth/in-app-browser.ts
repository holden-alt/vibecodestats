// Detect in-app browsers (Twitter, Facebook, Instagram, LinkedIn, etc.) where
// GitHub OAuth almost always fails — third-party cookie restrictions, redirect
// handling issues, and sometimes outright GitHub blocking.
//
// When detected, the signin route bounces to /auth/open-in-browser instead
// of starting the OAuth dance, so we save the user 7 failed clicks.

// Stable substrings present in each in-app browser's User-Agent.
// Source: each app's documented UA + observed strings from our own analytics.
const IN_APP_BROWSER_SIGNATURES: { id: string; needle: RegExp; label: string }[] = [
  // Twitter / X for iOS uses "Twitter for iPhone" — for Android, "TwitterAndroid"
  { id: 'twitter', needle: /Twitter for iPhone|TwitterAndroid/i, label: 'X (Twitter)' },

  // Facebook iOS/Android — FBAN=app, FBAV=version, FB_IAB=in-app-browser
  { id: 'facebook', needle: /FBAN\/|FBAV\/|FB_IAB\/|FB4A\//i, label: 'Facebook' },

  // Instagram
  { id: 'instagram', needle: /Instagram /i, label: 'Instagram' },

  // LinkedIn
  { id: 'linkedin', needle: /LinkedInApp/i, label: 'LinkedIn' },

  // TikTok
  { id: 'tiktok', needle: /musical_ly|BytedanceWebview|TikTok/i, label: 'TikTok' },

  // Snapchat
  { id: 'snapchat', needle: /Snapchat/i, label: 'Snapchat' },

  // Pinterest
  { id: 'pinterest', needle: /Pinterest/i, label: 'Pinterest' },

  // Discord (mobile in-app)
  { id: 'discord', needle: /DiscordBot|Discord\//i, label: 'Discord' },

  // Slack mobile in-app browser
  { id: 'slack', needle: /Slack\//i, label: 'Slack' },

  // WeChat / Line — relevant for international users
  { id: 'wechat', needle: /MicroMessenger/i, label: 'WeChat' },
  { id: 'line', needle: /Line\//i, label: 'Line' },

  // Reddit
  { id: 'reddit', needle: /Reddit\//i, label: 'Reddit' },
];

export type InAppBrowserHit = { id: string; label: string };

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowserHit | null {
  if (!userAgent) return null;
  for (const sig of IN_APP_BROWSER_SIGNATURES) {
    if (sig.needle.test(userAgent)) {
      return { id: sig.id, label: sig.label };
    }
  }
  return null;
}

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(userAgent: string | null | undefined): Platform {
  if (!userAgent) return 'other';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}
