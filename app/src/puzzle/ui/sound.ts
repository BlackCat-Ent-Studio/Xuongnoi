/**
 * Sound of the puzzle game: short effects and one soft background music loop, all made with WebAudio code
 * (no audio files). Screens only call these functions; they respect the player's settings themselves.
 *
 * Contract between the screen code and the sound code: the names below are the only events.
 * Browsers start audio only after a user gesture, so `unlockAudio()` is called from the first tap.
 */

export type SfxName =
  | 'tap' // any button
  | 'pick' // a tray piece placed on the board
  | 'wire' // a wire connected
  | 'unwire' // a wire or piece removed
  | 'run' // CHẠY pressed
  | 'stop' // DỪNG pressed
  | 'win' // level won
  | 'lose' // level lost
  | 'star' // one star appears on the win card
  | 'hint' // "?" pressed
  | 'unlock' // a new level opens on the map
  | 'page'; // screen transition

/** Which music plays: the calm menu loop (title, map) or the play loop (inside a level). */
export type MusicScene = 'menu' | 'level';

/** Plays one effect if effects are on. Safe to call before audio is unlocked (it is then silent). */
export function playSfx(_name: SfxName): void {
  // implemented by the sound module
}

/** Starts (or switches to) a music loop if music is on; keeps it across screens of the same scene. */
export function startMusic(_scene: MusicScene): void {
  // implemented by the sound module
}

export function stopMusic(): void {
  // implemented by the sound module
}

/** Call from the first user gesture (pointerdown/keydown) so the browser lets audio play. */
export function unlockAudio(): void {
  // implemented by the sound module
}
