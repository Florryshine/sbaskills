// lib/publishers/base.js
//
// Every platform adapter implements this shape. The publish-jobs engine
// only ever calls `publish(channel, contentAsset, media)` — it never
// knows or cares about Graph API vs Bot API vs OAuth2 resumable uploads
// underneath. This is what makes "add a new platform" a one-file change.

/**
 * @typedef {Object} PublishResult
 * @property {string} externalId - the platform's own post/video id
 * @property {string} [externalUrl] - a direct link to the published post, if available
 */

/**
 * @typedef {Object} PublisherAdapter
 * @property {(channel: object, contentAsset: object, media: object[]) => Promise<PublishResult>} publish
 * @property {(channel: object) => Promise<boolean>} [refreshToken] - optional, for platforms with expiring tokens
 */

export class PublishError extends Error {
  constructor(message, { retryable = true, rateLimited = false } = {}) {
    super(message);
    this.name = 'PublishError';
    this.retryable = retryable;
    this.rateLimited = rateLimited;
  }
}
