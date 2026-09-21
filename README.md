# Move2Move - GitHub Organization Contributions Dashboard

A high-performance, visually refined engineering analytics dashboard built to track member contributions, impact scoring, code reviews, and commit velocity across private repositories in the [Move2Move](https://github.com/Move2Move) organization.

---

## Key Features

1. **Contributor Leaderboard & Impact Ranking**:
   - Comprehensive roster tracking commits, merged pull requests, pull request reviews, issues, and code churn (+lines / -lines).
   - Weighted impact score algorithm reflecting full development and collaboration footprint.
   - Filter contributors by username, name, or repository.
   - Toggle between responsive Table View and Card Grid View.
   - Sort by Impact Score, Commits, Merged PRs, Reviews, or Lines of Code.

2. **Contributor Drill-Down Modal**:
   - Detailed individual contributor profile.
   - Hourly activity cadence (7x24 weekly punchcard).
   - Repository contribution footprint with percentage distribution.
   - Chronological timeline of recent commits, pull requests, and peer reviews.

3. **High-Level Organization Bento Metrics**:
   - Total active contributors across private repositories.
   - Total commits and delivery velocity.
   - Pull request merge success rate (Merged vs Open).
   - Code churn volume (+lines added / -lines deleted).
   - Peer review participation percentage.

4. **Organization Contribution Heatmap**:
   - Multi-week calendar heatmap showing daily commit, PR, and review activity across all private repos.
   - Hover inspection for daily contributor throughput.

5. **Private Repositories Breakdown**:
   - Language breakdown, descriptions, and commit/PR counts per repository.
   - List of top contributors for each repository.

6. **Client-Side Security & Rate-Limit Optimization**:
   - Token is stored strictly in your browser's local storage or loaded via `.env`.
   - Direct browser-to-GitHub REST API communication (no intermediate server).
   - LocalStorage caching preserves API quotas.
   - Live telemetry pipeline tracks rate limit consumption in real time.
   - Filter out repositories you do not want tracked via `.env` (`VITE_EXCLUDED_REPOS`).
   - Export full contributor report to CSV for standups or reviews.

---

## Environment Variables & Repository Exclusions

You can configure organization settings and exclude specific repositories directly via a `.env` file in the project root:

```env
# Target GitHub Organization & Authentication
VITE_GITHUB_ORG=Move2Move
VITE_GITHUB_TOKEN=ghp_your_classic_personal_access_token_here

# Exclude specific repositories from tracking (comma-separated names)
VITE_EXCLUDED_REPOS=demo-repository, .github, test-sandbox
```

- **`VITE_EXCLUDED_REPOS`**: Comma-separated list of repository names to ignore. Excluded repositories are not fetched from GitHub, saving API rate limit quota, and their commits and PRs are excluded from contributor impact scores, overview metrics, and repository manifests.
- **In-App Management**: You can also review active `.env` exclusions or add custom exclusions directly from the **CONFIG_PAT** settings dialog.

---

## Getting Started

### 1. Install Dependencies
Run the following command in the project root:

```bash
npm install
```

### 2. Run the Development Server
Start the local Vite development server:

```bash
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## Configuring GitHub Authentication for Private Repositories

Because repositories in Move2Move are private, a GitHub Personal Access Token (Classic) is required to query commits and pull requests.

### Steps to Generate Your Token:
1. Navigate to **GitHub.com** &gt; **Settings** (top-right avatar) &gt; **Developer Settings**.
2. Click **Personal Access Tokens** &gt; **Tokens (classic)**.
3. Click **Generate new token (classic)**.
4. Set a Note (e.g. `Move2Move Contributions Dashboard`).
5. Select the following required scopes:
   - `repo` (Full control of private repositories: repo:status, repo_deployment, public_repo, repo:invite, security_events)
   - `read:org` (Read org and team membership, read org projects)
   - `read:user` (Read user profile data)
6. Click **Generate token** and copy the string (starts with `ghp_`).
7. **Important**: If Move2Move uses SAML Single Sign-On, click **Configure SSO** next to your generated token and click **Authorize** for the `Move2Move` organization.

### Connecting in the Dashboard:
1. In the dashboard header, click **CONFIG_PAT**.
2. Paste your token in the **Classic Personal Access Token** field (or provide `VITE_GITHUB_TOKEN` in `.env`).
3. Optionally specify repositories to exclude in **Excluded Repositories Filter**.
4. Click **Test Connection** to verify your authentication and check your remaining API rate limit.
5. Click **Save & Connect**. The dashboard will automatically query and index Move2Move.

---

## Project Structure

```
org-tracker/
├── index.html                     # HTML entry point with Google Fonts
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite bundler configuration
└── src/
    ├── main.tsx                   # React root entry
    ├── App.tsx                    # Main dashboard application layout & state
    ├── types/
    │   └── index.ts               # Data models and interfaces
    ├── styles/
    │   └── index.css              # Dark mode design tokens & styling
    ├── services/
    │   ├── githubApi.ts           # GitHub REST API client & rate limiter
    │   ├── dataAggregator.ts      # Metric calculation & impact scoring
    │   └── cacheService.ts        # LocalStorage and credentials storage
    └── components/
        ├── Icons.tsx              # Clean SVG icons
        ├── Header.tsx             # App bar, live status, time filters, and actions
        ├── OverviewCards.tsx      # Bento grid summary metrics
        ├── ActivityHeatmap.tsx    # Organization contribution calendar & velocity
        ├── ContributorLeaderboard.tsx # Searchable, sortable contributor table/cards
        ├── ContributorDetailModal.tsx # Drill-down punchcards and timelines
        ├── RepoBreakdown.tsx      # Private repository breakdown
        ├── SettingsModal.tsx      # GitHub PAT configuration & validation
        └── SyncProgressModal.tsx  # Live progress dialog during repository sync
```
