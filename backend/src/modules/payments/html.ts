export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Minimal mobile-friendly HTML page used inside the in-app browser during checkout. */
export const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;color:#111;margin:0;padding:32px 20px;text-align:center}
.card{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 22px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
h1{font-size:26px;margin:8px 0}.muted{color:#6b7280;font-size:13px}
button{display:block;width:100%;padding:14px;margin-top:12px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-size:16px;font-weight:600}
button.secondary{background:#e5e7eb;color:#111}.badge{display:inline-block;background:#fef3c7;color:#92400e;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600}
.ok{font-size:48px;color:#0f766e}
</style></head><body><div class="card">${body}</div></body></html>`;
