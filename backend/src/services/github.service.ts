import axios from "axios";

export class GitHubService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID!;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET!;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${process.env.BASE_URL || "http://localhost:3000"}/api/auth/callback`,
      scope: "read:user",
      state,
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
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
    const response = await axios.get("https://api.github.com/user", {
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
