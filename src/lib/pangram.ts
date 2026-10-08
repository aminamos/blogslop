// Pangram Labs async AI-detection client.
// Docs: https://docs.pangram.com/api-reference/ai-detection

const BASE = "https://text.external-api.pangram.com";

export class PangramError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function createTask(
  apiKey: string,
  text: string,
  model: string,
): Promise<{ taskId: string }> {
  const res = await fetch(`${BASE}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ text, model, public_dashboard_link: false }),
  });
  if (!res.ok) {
    throw new PangramError(res.status, `Pangram /task failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { task_id?: string };
  if (!body.task_id) throw new PangramError(502, "Pangram /task returned no task_id");
  return { taskId: body.task_id };
}

export interface PangramTaskResult {
  stage: string;
  fractionAi?: number;
  fractionAiAssisted?: number;
  prediction?: string;
  predictionShort?: string;
  headline?: string;
  version?: string;
}

export async function getTask(apiKey: string, taskId: string): Promise<PangramTaskResult> {
  const res = await fetch(`${BASE}/task/${taskId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new PangramError(
      res.status,
      `Pangram /task/${taskId} failed: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as {
    stage?: string;
    fraction_ai?: number;
    fraction_ai_assisted?: number;
    prediction?: string;
    prediction_short?: string;
    headline?: string;
    version?: string;
  };
  return {
    stage: body.stage ?? "unknown",
    fractionAi: body.fraction_ai,
    fractionAiAssisted: body.fraction_ai_assisted,
    prediction: body.prediction,
    predictionShort: body.prediction_short,
    headline: body.headline,
    version: body.version,
  };
}
