declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** 'staging' or 'production' when deployed with scripts/deploy-cloudflare.mjs. */
    ROMLY_ENV?: string;
  }
}
