export interface GitHubSyncConfig {
  token: string;
  repo: string; // e.g., "owner/repo"
  path: string; // e.g., "backup.json"
}

/**
 * Pushes tab outline data as a JSON file to a GitHub repository.
 */
export async function pushToGitHub(config: GitHubSyncConfig, data: any): Promise<void> {
  const { token, repo, path } = config;
  if (!token || !repo || !path) {
    throw new Error("Missing GitHub configuration (token, repo, or path).");
  }

  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  
  // Safe base64 encoding that supports UTF-8 (Unicode) characters
  const jsonStr = JSON.stringify(data, null, 2);
  const contentBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

  // 1. Check if the file already exists to retrieve its current SHA (required for updates)
  let sha: string | undefined = undefined;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.ok) {
      const info = await res.json();
      sha = info.sha;
    }
  } catch (err) {
    console.warn("Could not retrieve current file SHA (it might be a new file):", err);
  }

  // 2. Perform the PUT request to create or update the file
  const body: any = {
    message: `Backup tabs: ${data.nodes?.length || 0} items`,
    content: contentBase64,
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { message: errorText };
    }
    throw new Error(parsedError.message || `GitHub Push failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Pulls and parses the tab outline JSON file from a GitHub repository.
 */
export async function pullFromGitHub(config: GitHubSyncConfig): Promise<any> {
  const { token, repo, path } = config;
  if (!token || !repo || !path) {
    throw new Error("Missing GitHub configuration (token, repo, or path).");
  }

  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    throw new Error(`Backup file not found in repository at path: "${path}". Make sure the path is correct and the file exists.`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { message: errorText };
    }
    throw new Error(parsedError.message || `GitHub Pull failed: ${response.status} ${response.statusText}`);
  }

  const fileData = await response.json();
  const base64Content = fileData.content.replace(/\s/g, ""); // Remove potential newlines
  const jsonString = decodeURIComponent(escape(atob(base64Content)));
  return JSON.parse(jsonString);
}
