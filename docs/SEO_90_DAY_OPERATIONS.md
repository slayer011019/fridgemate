# 90-Day Organic Search Operations

Weekly operating guide for 오늘뭐먹지 after the technical SEO and public content-hub rollout.

## Account Setup

- [ ] Verify the `오늘뭐먹지.com` Search Console domain property with a DNS TXT record.
- [ ] Submit `https://오늘뭐먹지.com/sitemap.xml` and inspect the home page, `/recipes`, one ingredient hub, one guide, and one recipe detail.
- [ ] Create or select the GA4 property, set `VITE_GA_MEASUREMENT_ID`, deploy, and verify that analytics stays unloaded until consent.
- [ ] Link GA4 and Search Console and mark `activation_completed` and `signup_completed` as key events.

## Weekly Review

Run once per week and change at most one public page.

1. Check Page indexing, Crawl stats, sitemap processing, and Recipe enhancement errors.
2. Split queries into brand (`오늘뭐먹지`, `오늘 뭐 먹지`, `FridgeMate`) and non-brand groups.
3. Review non-brand queries in positions 4–20 and pages with impressions but low click-through rate.
4. Prioritize only when the query matches existing source-backed recipes and the page can lead naturally to ingredient registration or menu recommendations.
5. Improve one title, description, intro, or internal-link group; do not add keyboard-layout typo keywords.

Every two weeks, run the production build so the SEO verifier checks 113 public URLs and confirms every recipe has an internal link from `/recipes`. Every four weeks, update the baseline table.

## 28-Day Baseline

| Period | Indexed URLs | Non-brand impressions | Non-brand clicks | Organic sessions | Activation events | Signups | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Days 1–28 |  |  |  |  |  |  |  |
| Days 29–56 |  |  |  |  |  |  |  |
| Days 57–84 |  |  |  |  |  |  |  |

## Day-90 Decision Rules

- Keep critical indexing, canonical, sitemap, and structured-data errors at zero.
- Confirm all eight new hubs and guides are discovered and valid.
- If the first period has at least 20 non-brand clicks, target 30% growth in the final period; otherwise target 50 non-brand clicks in the final period.
- Evaluate the 15% relative activation-rate improvement only after at least 100 organic sessions; below that threshold, report direction without declaring a conversion result.
- Do not bulk-publish more recipes until the initial hubs have enough query and click data to identify a real content gap.
