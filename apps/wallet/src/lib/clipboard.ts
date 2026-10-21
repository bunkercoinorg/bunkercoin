/** Copy with a legacy fallback — clipboard API is missing or blocked in some browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } finally {
      area.remove();
    }
  }
}

export const SENSITIVE_CLEAR_MS = 30_000;

/** Only reads when permission is already granted, so the check never pops a prompt. */
async function readIfPermitted(): Promise<string | null> {
  try {
    const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
    if (status.state !== 'granted') return null;
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

async function clearIfUnchanged(text: string): Promise<void> {
  const current = await readIfPermitted();
  // Unreadable means we cannot tell; a recovery phrase left behind is the worse outcome.
  if (current !== null && current !== text) return;
  try {
    await navigator.clipboard.writeText('');
  } catch {
    window.addEventListener('focus', () => void clearIfUnchanged(text), { once: true });
  }
}

/** Copy secrets (recovery phrase): the clipboard is wiped after 30s unless it was replaced since. */
export async function copySensitive(text: string): Promise<boolean> {
  const ok = await copyText(text);
  if (ok) setTimeout(() => void clearIfUnchanged(text), SENSITIVE_CLEAR_MS);
  return ok;
}
