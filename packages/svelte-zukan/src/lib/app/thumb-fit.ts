/** a box in the example's page, which never scrolls */
export type Box = { left: number; top: number; width: number; height: number };

const PADDING = 16;
/** below this the text of a full card is too small to read, so a taller example is cut at the bottom instead */
const MIN_SCALE = 0.3;

/**
 * How to show `content` in a thumbnail of `width` × `height`: scaled to fit, never above its real size, and centred,
 * or started at the left or top edge when it is still too wide or tall. `x` and `y` move the content, in layout pixels.
 */
export function fitThumb(content: Box, width: number, height: number) {
  const room = (size: number) => Math.max(size - 2 * PADDING, 1);
  const scale = Math.max(MIN_SCALE, Math.min(room(width) / content.width, room(height) / content.height, 1));
  const place = (start: number, size: number, view: number) =>
    size * scale > room(view) ? PADDING / scale - start : (view / scale - size) / 2 - start;
  return {
    scale,
    x: place(content.left, content.width, width),
    y: place(content.top, content.height, height)
  };
}
