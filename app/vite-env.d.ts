/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 共用房間的伺服器（Cloudflare Worker），例如 https://dsa-whiteboard-collab.xxx.workers.dev；沒設定就不能共用 */
  readonly VITE_COLLAB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
