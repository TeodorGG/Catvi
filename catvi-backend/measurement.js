const regions = require("./region-names.json");
const providers = ["Moldtelecom", "StarNet", "Orange", "Moldcell", "Altele"];
const types = ["ethernet", "wifi", "mobile", "unknown"];
const finite = (n, min, max) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

function validateMeasurement(body) {
  if (!body || body.consent !== true || body.consentVersion !== "2026-09-21")
    return "consent_required";
  if (![body.ping, body.jitter].every((n) => finite(n, 0, 30000)))
    return "invalid_latency";
  for (const side of ["download", "upload"]) {
    if (
      !Number.isSafeInteger(body[side + "Bytes"]) ||
      !finite(body[side + "Bytes"], 1, 240000000) ||
      !finite(body[side + "Ms"], 1, 90000)
    )
      return "invalid_transfer";
    const speed = (body[side + "Bytes"] * 8) / body[side + "Ms"] / 1000;
    if (speed > 100000) return "invalid_speed";
  }
  if (
    !Number.isInteger(body.httpSamples) ||
    body.httpSamples !== 8 ||
    !Number.isInteger(body.httpFailures) ||
    body.httpFailures < 0 ||
    body.httpFailures >= body.httpSamples
  )
    return "invalid_samples";
  if (body.region !== null && !regions.includes(body.region))
    return "invalid_region";
  if (body.provider !== null && !providers.includes(body.provider))
    return "invalid_provider";
  if (!types.includes(body.connectionType)) return "invalid_connection";
  return null;
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
module.exports = { validateMeasurement, csvCell, regions, providers };
