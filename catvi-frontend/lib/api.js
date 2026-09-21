export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";
export async function request(
  path,
  { method = "GET", body, signal, headers = {} } = {},
) {
  const response = await fetch(API_BASE + path, {
    method,
    credentials: "include",
    cache: "no-store",
    signal,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data?.error || "request_failed"), {
      status: response.status,
    });
  return data;
}
export const providers = [
  "Moldtelecom",
  "StarNet",
  "Orange",
  "Moldcell",
  "Altele",
];
export const number = (value) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("ro-MD", { maximumFractionDigits: 1 });
export function saveLocalResult(result) {
  try {
    const old = JSON.parse(localStorage.getItem("catvi-history-v2") || "[]");
    localStorage.setItem(
      "catvi-history-v2",
      JSON.stringify([result, ...(Array.isArray(old) ? old : [])].slice(0, 50)),
    );
    return true;
  } catch {
    return false;
  }
}
