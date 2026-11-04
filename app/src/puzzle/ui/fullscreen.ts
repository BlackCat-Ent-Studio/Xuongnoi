/**
 * Full screen on phones and tablets. A web page may only ask for full screen inside a tap, so this is called from the
 * player's own taps ("Chơi" on the title, a level on the map). It hides the browser's address bar and the phone's
 * navigation bar (Android Chrome), and keeps the screen landscape where the browser allows it. If the player leaves full
 * screen, the next such tap asks again. Desktops (fine pointer) are left alone. iPhone Safari has no page full screen:
 * the call does nothing there.
 */
export function enterFullscreenOnTouch(): void {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  if (document.fullscreenElement || typeof root.requestFullscreen !== 'function') return;
  root
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      // Orientation lock only works in full screen, and not on every browser: a refusal is fine.
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      return orientation.lock?.('landscape');
    })
    .catch(() => undefined);
}
