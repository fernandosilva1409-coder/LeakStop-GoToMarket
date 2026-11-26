// Lightweight liveness probe for the Fly.io http health check.
// No auth, no external calls — just confirms the Next.js server is up.
export default function handler(req, res) {
  res.status(200).json({ status: "ok" });
}
