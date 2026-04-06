import axios from "axios";

export class GitHubService {
  private clientId: string;
  private clientSecret: string;
  private oauthBaseUrl: string;
  private apiBaseUrl: string;

  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID!;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET!;

    // Allow GitHub Enterprise / custom OAuth hosts by configuring base URLs.
    // Keep defaults for backward compatibility with existing setups.
    const normalize = (url: string) => url.replace(/\/$/, "");
    this.oauthBaseUrl = normalize(process.env.GITHUB_OAUTH_BASE_URL || "https://github.com");
    this.apiBaseUrl = normalize(process.env.GITHUB_API_BASE_URL || "https://api.github.com");
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${process.env.BASE_URL || "http://localhost:3000"}/api/auth/callback`,
      scope: "read:user",
      state,
    });

    return `${this.oauthBaseUrl}/login/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await axios.post(
      `${this.oauthBaseUrl}/login/oauth/access_token`,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    return response.data.access_token;
  }

  async getUserInfo(token: string): Promise<{ id: string; login: string }> {
    const response = await axios.get(`${this.apiBaseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    return {
      id: response.data.id.toString(),
      login: response.data.login,
    };
  }
}
