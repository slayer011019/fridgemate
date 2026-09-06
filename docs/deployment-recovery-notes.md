# 공개 콘텐츠 복구: 배포 원인과 확인 절차

조사: 2026-09-06. 공개 HTTP 응답, GitHub 배포/커밋 기록, 현재 로컬 소스를 읽어 확인했다. 이 기록 자체는 배포·도메인 설정·AdSense 재심사를 실행한 기록이 아니다.

## 원인 확인

**공개 레시피가 빠진 이유는 최신 운영 소스에서 해당 기능을 삭제했기 때문이다.** 이전 점검의 ‘로컬 113개 / 운영 5개’ 차이는 확인됐지만, 이를 빌드 실패나 단순한 배포 누락이라고 확정하면 안 된다.

| 증거 | 확인한 상태 |
| --- | --- |
| 조사를 시작한 로컬 체크아웃 | `8efa882` (2026-08-31 KST), 공개 레시피 100개·허브 6개·가이드 2개 포함 |
| 조회 시점 GitHub `main` | `ca7b6d256f402965fc29d1478e729b2a6fdc2dc3`, 로컬보다 16개 커밋 앞섬 |
| 최신 Production 배포 | GitHub deployment `6237293328`, 위 커밋으로 2026-09-03 05:02:20 UTC에 `success` |
| Production 환경 URL | `https://fridgemate-32vc8kkfx-fridgemates-projects.vercel.app` |
| PR #41 | 커밋 설명에 `refactor: remove public recipe catalog` 포함. 공개 데이터·카탈로그·허브·가이드·상세 페이지 삭제가 실제 diff에 존재 |
| 최신 소스의 경로 목록 | `PUBLIC_ROUTES`가 기본 5개만 반환. 공개 상세/허브/가이드 Vercel rewrite도 제거됨 |
| 운영 도메인 | 사이트맵 5개와 메인 자산 `index-CtJPKFF5.js` 재확인. 2026-09-06 04:42:10 UTC 전수 검사에서 공개 예정 113개 중 기본 5개 HTTP 200, 추가 108개 HTTP 404, 사이트맵 누락 108개. 없는 경로 4개는 404. HTTPS 응답은 Cloudflare를 거쳐 Vercel에서 제공됨 |

근거:

- [공개 카탈로그 삭제를 포함한 최신 커밋](https://github.com/slayer011019/fridgemate/commit/ca7b6d256f402965fc29d1478e729b2a6fdc2dc3)
- [PR #41](https://github.com/slayer011019/fridgemate/pull/41)
- [최신 Production 배포 상태 API](https://api.github.com/repos/slayer011019/fridgemate/deployments/6237293328/statuses)
- [운영 커밋의 공개 경로 정의](https://github.com/slayer011019/fridgemate/blob/ca7b6d256f402965fc29d1478e729b2a6fdc2dc3/src/utils/routeMetadata.js)
- [운영 커밋의 Vercel 설정](https://github.com/slayer011019/fridgemate/blob/ca7b6d256f402965fc29d1478e729b2a6fdc2dc3/vercel.json)
- [실제 운영 사이트맵](https://xn--wh1bs8l5xa003adme.com/sitemap.xml)

GitHub의 Production 성공 기록과 운영 소스/응답의 일치는 강한 근거다. 다만 해당 도메인의 현재 Vercel alias 배정과 배포 빌드 로그는 아직 관리자 화면/API로 직접 대조하지 못했다. 최신 GitHub 배포가 현재 alias 대상이라는 주장은 그 확인 전에는 추론으로 취급한다.

## 접근 상태

조회 당시 Vercel CLI는 사용자 `edgar1019522-2077`, 팀 `hyeonghos-projects`에 연결돼 있었다. 조회 가능한 두 프로젝트는 대상 서비스와 달랐다. GitHub 배포 기록의 팀/프로젝트는 **`fridgemates-projects / fridgemate`**다. 이 scope의 `vercel inspect`는 `The specified scope does not exist`로 끝났다. 이는 현재 CLI 접근 범위에서 조회할 수 없다는 뜻이며, 실제 팀이 없다는 증거는 아니다.

GitHub CLI의 저장된 인증은 HTTP 401이었다. GitHub connector와 인증이 필요 없는 공개 GitHub API로 커밋/배포 증거를 확인했다. 토큰이나 비밀 환경변수는 출력·수정하지 않았다.

관리자 연결 후 확인할 대상은 위 팀의 `fridgemate` 프로젝트다. Production 도메인 alias, Git 연결 브랜치/배포 커밋, Root Directory, `npm run build`, 출력 `dist`, postbuild 로그를 대조한다. 현재 `vercel.json`은 `npm run build`와 `dist`를 지정하지만 대시보드 설정과 실제 실행 로그의 일치는 별도 확인 대상이다.

## 복구 소스 기준

최신 `ca7b6d2`에서 만든 작업 트리에 공개 기능을 복원한다. 오래된 체크아웃 전체를 재배포하면 이후 보안·개인정보·계정·이벤트 처리 수정과 의존성 갱신을 되돌릴 수 있다.

특히 아래 구현을 유지한 상태에서 공개 경로와 콘텐츠를 추가한다.

- SEO 생성기의 `scripts/lib/seoHtmlSecurity.js` 기반 `cleanGeneratedSeo`와 `removeCanonicalLinks`.
- SEO 검증기의 `hasOnlySameOriginExecutableScripts` 동의 전 실행 스크립트 검사.
- Vercel의 전체 보안 헤더/CSP, 대표 도메인 리다이렉트, 개인 기능 화면의 `X-Robots-Tag`.
- 자체 호스팅 OCR 자산을 복사하는 기존 postbuild 단계.
- 최신 메뉴 선택/관심 없음 기능, 동의 기반 분석, 인증·외부 AI·개인정보 관련 동작.

레시피 분량과 키워드 등 기존 로컬 수정 사항도 공개 스키마에 보존한다. 개인정보는 공개 HTML·사이트맵·구조화 데이터에 포함하지 않는다.

## 반복 가능한 운영 검증

`scripts/verify-public-deployment.js`는 현재 `PUBLIC_ROUTES`와 새 빌드의 HTML을 기준으로 실제 응답을 비교한다. URL 개수를 하드코딩하지 않는다.

```sh
npm run build
npm run verify:public-deployment -- --report /tmp/fridgemate-public-deployment.json
```

다른 동일 배포 대상이나 로컬 HTTP 서버를 확인할 때:

```sh
npm run verify:public-deployment -- --origin http://127.0.0.1:4173 --report /tmp/fridgemate-public-local.json
```

지원 옵션은 `--origin`, `--dist`, `--concurrency` (기본 6, 최대 12), `--timeout` (기본 요청당 12000 ms), `--report`, `--help`다. 응답을 비교할 빌드가 없거나 소스와 메타/사이트맵이 다르면 요청 전에 실패한다. 변경된 본문까지 확인하려면 항상 새 빌드를 먼저 실행한다. 다른 origin으로 리다이렉트되면 실패 처리해 preview가 운영 사이트를 대신 읽고 통과하는 일을 막는다. 현재 Vercel 설정은 `*.vercel.app`을 대표 도메인으로 보내므로 실제 배포 검증은 대표 도메인에서 수행한다.

검사 내용:

- 모든 공개 URL의 HTTP 200, 요청 경로/출처 유지, HTML 응답.
- 현재 경로의 제목, canonical 1개, H1, 프리렌더 표시, 본문, 구조화 데이터 존재.
- 새 빌드의 `main` 본문과 실제 본문의 일치. 공백과 실제 운영에서 관찰한 Cloudflare 이메일 난독화 래퍼만 정규화하므로 홈 HTML로 대체한 200도 실패한다. 이메일 래퍼는 스크립트 실행 없이 복호화해 원래 본문/메일 링크와 비교한다.
- `noindex`/`none` HTTP 헤더 및 robots/googlebot 메타 차단 여부.
- 새 빌드의 내부 링크가 실제 HTML에 존재하고, 알 수 없는 내부 경로가 없는지 확인.
- 사이트맵의 정확한 공개 URL 집합, 누락·중복·예상 밖 경로.
- 일반·레시피·재료 허브·가이드 네임스페이스의 없는 경로 4개가 실제 HTTP 404를 반환하는지 확인.

실패 또는 요청 시간 초과는 종료 코드 1이다. JSON 보고서에는 점검 시간·target·검사 소스 커밋·페이지별 오류가 포함된다. 기록된 `sourceCommit`은 검증기를 실행한 체크아웃의 커밋이며 운영 배포 커밋의 증거가 아니다. 미커밋 수정이 있을 수 있다는 점도 보고서에 명시한다.

일반 Vite preview는 Vercel rewrite/404를 그대로 구현하지 않으므로 routing을 재현하는 로컬 서버나 실제 배포에서 이 검사를 수행해야 한다.

## 검증기 확인과 남은 검증

최종 Node 24 / jsdom 30 환경의 임시 로컬 HTTP fixture로 기존 113개 빌드 페이지를 제공했을 때 113/113, 사이트맵, 없는 경로 검사가 통과했다. Cloudflare 이메일 난독화 래퍼를 주입한 동일 콘텐츠도 113/113 통과했다. 같은 fixture에 ‘메뉴 경로에서 홈 HTML을 HTTP 200으로 반환’, 소개 페이지 `noindex` 헤더, 사이트맵 URL 누락, 없는 경로 HTTP 200을 주입한 실행은 각각을 발견하고 종료 코드 1을 반환했다. 검사기 자체의 구문 검사와 ESLint도 통과했다.

최신 보안 커밋 기반 작업 트리에 공개 라우트·구조화 데이터·프리렌더/Vercel rewrite를 복원한 뒤 `routeMetadata`, `structuredData`, `seo-html-security` 집중 테스트 3개 파일 24개 테스트와 관련 파일 ESLint가 통과했다. 전체 테스트·새 통합 빌드는 상위 구현 작업에서 별도로 실행한다.

이는 검증기 동작 확인이다. 개선된 공개 기능이 운영에 배포됐다는 뜻은 아니다. 새 통합 빌드의 테스트·빌드·대표 브라우저 동선 결과는 구현 작업의 최종 기록에 연결한다. Vercel 관리자 대조, 운영 113개 페이지 전수 검사, 실제 모바일·데스크톱 이용 흐름, Search Console 실시간 URL 검사/렌더링은 운영 반영 후 완료해야 한다. 이 검증기는 Google의 색인/내부 심사나 로그인 후 계정 기능까지 검증하지 않는다.
