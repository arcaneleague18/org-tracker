/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_ORG?: string;
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_EXCLUDED_REPOS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
