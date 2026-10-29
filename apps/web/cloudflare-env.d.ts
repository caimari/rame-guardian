declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET?: R2Bucket;
    NEBIUS_API_KEY?: string;
  }
}
