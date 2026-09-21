import { API_BASE, request } from "./api";

// HTTP throughput, not ICMP or UDP. Only completed, acknowledged bytes count.
export async function runMeasurement({ signal, onPhase, onProgress }) {
  let token;
  const combined = (timeout) =>
    AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
  const headers = () => ({ "X-Test-Token": token });
  try {
    const session = await request("/speedtest/session", {
      method: "POST",
      signal: combined(10000),
    });
    token = session.token;
    const get = async (path, options = {}) => {
      const res = await fetch(API_BASE + "/speedtest/" + path, {
        cache: "no-store",
        signal: combined(30000),
        headers: headers(),
        ...options,
      });
      if (!res.ok)
        throw new Error(
          res.status === 429 ? "transfer_limit" : "measurement_failed",
        );
      return res;
    };
    onPhase("ping");
    // Warm up the connection; exclude TLS setup from the latency samples.
    await get("ping");
    const samples = [];
    let httpFailures = 0;
    for (let i = 0; i < 8; i++) {
      const start = performance.now();
      try {
        await get("ping", { signal: combined(3000) });
        samples.push(performance.now() - start);
      } catch (error) {
        if (signal.aborted) throw error;
        httpFailures++;
      }
    }
    if (!samples.length) throw new Error("server_unreachable");
    const ping = samples.reduce((a, b) => a + b, 0) / samples.length;
    const jitter = Math.sqrt(
      samples.reduce((sum, v) => sum + (v - ping) ** 2, 0) / samples.length,
    );
    async function transfer(side) {
      onPhase(side);
      let bytes = 0,
        size = side === "download" ? 1000000 : 500000;
      const uploadData = side === "upload" ? new Uint8Array(16000000) : null;
      if (uploadData)
        for (let offset = 0; offset < uploadData.length; offset += 65536)
          crypto.getRandomValues(
            uploadData.subarray(
              offset,
              Math.min(uploadData.length, offset + 65536),
            ),
          );
      let lastProgress = 0;
      const started = performance.now();
      // Adaptive batches, up to 115 MB in each direction, approximately 5s.
      // A single stream is deliberate and versioned in the methodology.
      do {
        signal.throwIfAborted();
        size = Math.min(size, 115000000 - bytes);
        const before = performance.now();
        if (side === "download") {
          const res = await get("download?size=" + size);
          if (res.headers.get("Content-Encoding"))
            throw new Error("compressed_response");
          const reader = res.body.getReader();
          let received = 0;
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            received += part.value.byteLength;
            const now = performance.now();
            if (now - lastProgress >= 80) {
              onProgress(
                side,
                ((bytes + received) * 8) / (now - started) / 1000,
              );
              lastProgress = now;
            }
          }
          if (received !== size) throw new Error("incomplete_download");
          bytes += received;
        } else {
          const data = uploadData.subarray(0, size);
          const response = await get("upload", {
            method: "POST",
            headers: {
              ...headers(),
              "Content-Type": "application/octet-stream",
            },
            body: data,
          });
          const receipt = await response.json();
          if (receipt.receivedBytes !== size)
            throw new Error("incomplete_upload");
          bytes += receipt.receivedBytes;
        }
        onProgress(side, (bytes * 8) / (performance.now() - started) / 1000);
        const elapsed = performance.now() - before;
        size = Math.round(
          Math.max(
            64000,
            Math.min(16000000, (size * 1000) / Math.max(elapsed, 1)),
          ),
        );
      } while (performance.now() - started < 5000 && bytes < 115000000);
      const ms = performance.now() - started;
      return { bytes, ms, mbps: (bytes * 8) / ms / 1000 };
    }
    const download = await transfer("download");
    const upload = await transfer("upload");
    return {
      token,
      server: session.server,
      created_at: new Date().toISOString(),
      down: download.mbps,
      up: upload.mbps,
      ping,
      jitter,
      httpFailures,
      httpSamples: 8,
      downloadBytes: download.bytes,
      uploadBytes: upload.bytes,
      downloadMs: download.ms,
      uploadMs: upload.ms,
    };
  } catch (error) {
    if (token)
      request("/speedtest/session", {
        method: "DELETE",
        headers: headers(),
      }).catch(() => {});
    throw error;
  }
}
