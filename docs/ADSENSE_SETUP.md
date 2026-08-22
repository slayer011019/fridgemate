# Google AdSense Readiness

The site-verification meta tag and `ads.txt` declaration for publisher `ca-pub-4133464450512249` are enabled in production. Google-served ads are disabled while the site is under policy review.

## Before activation

1. Complete the public site content and confirm that every main route is reachable without broken API calls.
2. Confirm that the public operator contact (`ibaekgom@gmail.com`) and data-retention wording in `/privacy` remain current.
3. Confirm that AdSense recognizes `오늘뭐먹지.com` and its `ads.txt`, then obtain the ad-unit slot IDs.
4. Select and configure a Google-certified consent management platform before serving ads where consent is required.
5. Review ad placement on desktop and mobile so ads cannot be mistaken for recipe or navigation actions.

## Vercel environment variables

```env
VITE_ADSENSE_VERIFICATION_ENABLED=true
VITE_ADSENSE_SERVING_ENABLED=false
VITE_ADSENSE_CLIENT=ca-pub-4133464450512249
VITE_ADSENSE_HOME_SLOT=0000000000
VITE_ADSENSE_RECIPES_SLOT=0000000000
```

The publisher settings are tracked in `.env.production` so production builds generate `ads.txt` and the ownership-verification meta tag. Keep `VITE_ADSENSE_SERVING_ENABLED=false` until the site has a `Ready` status. Configure slot IDs only after approval, keep Auto ads disabled, and review every manual placement before enabling serving. The build fails when verification is enabled with a malformed publisher ID.

## What the build does

- Vite inserts the matching AdSense account meta tag when site verification is enabled.
- The global AdSense script is omitted so Auto ads cannot appear on login, input, empty, or error screens during review.
- Home and recipe pages load the AdSense script and render reserved, responsive manual units only when serving is enabled and their slot IDs are valid.
- `postbuild` creates `dist/ads.txt` from the configured publisher ID.
- `/privacy` explains browser storage, service analytics, advertising, and cookies.
- `/about` and `/contact` provide public service and operator contact information.
- `robots.txt` points crawlers to the public `sitemap.xml`.

After deployment, verify:

```text
https://오늘뭐먹지.com/ads.txt
https://오늘뭐먹지.com/privacy
https://오늘뭐먹지.com/about
https://오늘뭐먹지.com/contact
https://오늘뭐먹지.com/robots.txt
https://오늘뭐먹지.com/sitemap.xml
```

Also inspect the generated page source for the `google-adsense-account` meta tag. Do not click live ads during testing.

Before enabling ad serving after approval:

1. Keep Auto ads disabled in AdSense, or configure page exclusions for every functional route.
2. Never serve ads on `/login`, `/signup`, `/account`, `/ingredients`, `/ingredients/new`, `/import`, loading, empty, or error screens.
3. Enable only reviewed manual slots on content-rich pages.
4. Recheck direct loads and client-side navigation for unexpected `adsbygoogle` elements and Google ad iframes.

References: [Connect a site to AdSense](https://support.google.com/adsense/answer/7584263), [AdSense cookies](https://support.google.com/adsense/answer/7549925), [Get AdSense code](https://support.google.com/adsense/answer/9274019).
