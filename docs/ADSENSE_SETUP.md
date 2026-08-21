# Google AdSense Readiness

Ad units are disabled by default. The site-verification script for publisher `ca-pub-4133464450512249` is present in the document head, while ad units and `ads.txt` remain disabled until the enable flag and slot IDs are configured.

## Before activation

1. Complete the public site content and confirm that every main route is reachable without broken API calls.
2. Replace the placeholder contact wording in `/privacy` with the real operator contact and finalized data-retention policy.
3. Confirm that AdSense recognizes `오늘뭐먹지.com`, then obtain the ad-unit slot IDs.
4. Select and configure a Google-certified consent management platform before serving ads where consent is required.
5. Review ad placement on desktop and mobile so ads cannot be mistaken for recipe or navigation actions.

## Vercel environment variables

```env
VITE_ADSENSE_ENABLED=true
VITE_ADSENSE_CLIENT=ca-pub-4133464450512249
VITE_ADSENSE_HOME_SLOT=0000000000
VITE_ADSENSE_RECIPES_SLOT=0000000000
```

Use values issued by the actual AdSense account. The build fails when AdSense is enabled with a malformed publisher ID.

## What the build does

- `index.html` includes the asynchronous AdSense site-verification script in the document `<head>`.
- Vite inserts the matching AdSense account meta tag when ad units are enabled.
- Home and recipe pages render reserved, responsive ad units only when their slot IDs are valid.
- `postbuild` creates `dist/ads.txt` from the configured publisher ID.
- `/privacy` explains browser storage, service analytics, advertising, and cookies.

After deployment, verify:

```text
https://오늘뭐먹지.com/ads.txt
https://오늘뭐먹지.com/privacy
```

Also inspect the generated page source for the `google-adsense-account` meta tag. Do not click live ads during testing.

References: [Connect a site to AdSense](https://support.google.com/adsense/answer/7584263), [AdSense cookies](https://support.google.com/adsense/answer/7549925), [Get AdSense code](https://support.google.com/adsense/answer/9274019).
