const DEFAULT_TIMEOUT_MS = 15_000;

export async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`request failed (${response.status} ${response.statusText})`);
  }
  return (await response.json()) as T;
}
