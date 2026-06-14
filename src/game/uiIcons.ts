/* Cute hand-drawn UI glyphs (NO emoji) in the game's rounded-stroke icon style.
   One place for every small action icon so they stay consistent and DRY. Use as
   innerHTML on a button; size/stroke come from the .uicon CSS class. */

export const ICON_EDIT =
  '<svg class="uicon" viewBox="0 0 24 24"><path d="M5 19.2 V15.6 L15.4 5.2 a1.8 1.8 0 0 1 2.6 0 l0.8 0.8 a1.8 1.8 0 0 1 0 2.6 L8.4 19.2 Z"/><path d="M13.9 6.7 L17.3 10.1"/><path d="M5 19.2 H8.6"/></svg>';

export const ICON_TRASH =
  '<svg class="uicon" viewBox="0 0 24 24"><path d="M5 7 H19"/><path d="M9.2 7 V5.6 a1 1 0 0 1 1-1 H13.8 a1 1 0 0 1 1 1 V7"/><path d="M6.6 7 L7.4 18.6 a1.6 1.6 0 0 0 1.6 1.5 H15 a1.6 1.6 0 0 0 1.6-1.5 L17.4 7"/><path d="M10 10.5 V16.4 M14 10.5 V16.4"/></svg>';

export const ICON_ERASER =
  '<svg class="uicon" viewBox="0 0 24 24"><path d="M4.2 16.4 L12.2 8.4 a2 2 0 0 1 2.8 0 L18.6 12 a2 2 0 0 1 0 2.8 L15.4 18 H8 Z"/><path d="M9 13.2 L13.6 17.8"/><path d="M8 18 H19"/></svg>';

export const ICON_PLAY =
  '<svg class="uicon" viewBox="0 0 24 24"><path d="M8 6.2 L18 12 L8 17.8 Z" fill="currentColor" stroke="none"/></svg>';

/* the canonical share glyph (same outline as the win card's Share button) */
export const ICON_SHARE =
  '<svg class="uicon" viewBox="0 0 24 24"><path d="M12 15 V4"/><path d="M8.5 7.5 L12 4 L15.5 7.5"/><path d="M6 12 V18.5 H18 V12"/></svg>';
