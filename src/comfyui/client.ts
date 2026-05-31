/**
 * ComfyUI API client — submit workflows, poll results, fetch images.
 */

const API_BASE = 'http://127.0.0.1:8188';

export interface QueueResult {
  promptId: string;
}

export interface ImageOutput {
  filename: string;
  subfolder: string;
  type: string;
}

export interface HistoryEntry {
  prompt: Record<string, unknown>;
  outputs: Record<string, { images: ImageOutput[] }>;
}

export interface HistoryResponse {
  [promptId: string]: HistoryEntry;
}

/** Submit a workflow JSON object to the queue. */
export async function queuePrompt(workflow: Record<string, unknown>): Promise<QueueResult> {
  const res = await fetch(`${API_BASE}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`ComfyUI prompt failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<QueueResult>;
}

/** Wait for a prompt to complete by polling the history endpoint. */
export async function waitForPrompt(
  promptId: string,
  pollMs = 1500,
  timeoutMs = 120_000,
): Promise<HistoryEntry> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${API_BASE}/history/${promptId}`);
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    const data = (await res.json()) as HistoryResponse;
    if (data[promptId]) return data[promptId];
    await sleep(pollMs);
  }
  throw new Error(`Prompt ${promptId} timed out after ${timeoutMs}ms`);
}

/** Fetch a generated image as a Blob. */
export async function fetchImage(filename: string, subfolder = '', type = 'output'): Promise<Blob> {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${API_BASE}/view?${params}`);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return res.blob();
}

/** Convenience: submit, wait, fetch first image. Returns a data URL. */
export async function generateImage(workflow: Record<string, unknown>): Promise<string> {
  const { promptId } = await queuePrompt(workflow);
  const history = await waitForPrompt(promptId);
  const outputs = history.outputs;
  // Find the first node output with images
  for (const nodeId of Object.keys(outputs)) {
    const imgs = outputs[nodeId]?.images;
    if (imgs && imgs.length > 0) {
      const blob = await fetchImage(imgs[0].filename, imgs[0].subfolder, imgs[0].type);
      return blobToDataUrl(blob);
    }
  }
  throw new Error('No image output found in history');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
