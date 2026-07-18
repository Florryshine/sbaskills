// lib/services/postiz.js
export class PostizClient {
  constructor(apiKey, workspaceId) {
    this.apiKey = apiKey;
    this.workspaceId = workspaceId;
    this.baseUrl = 'https://api.postiz.com/v1'; // replace with actual Postiz endpoint
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Postiz API error (${res.status}): ${text}`);
    }
    return res.json();
  }

  async createPost(platform, content, scheduledAt, mediaUrls = []) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: this.workspaceId,
        platform,
        content,
        scheduledAt,
        mediaUrls,
      }),
    });
  }

  async deletePost(postId) {
    return this.request(`/posts/${postId}`, { method: 'DELETE' });
  }

  async getChannels() {
    return this.request('/channels');
  }
}