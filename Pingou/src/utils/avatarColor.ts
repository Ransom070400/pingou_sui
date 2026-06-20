/**
 * A deterministic, pleasant avatar background color derived from a Sui address.
 * Same address → same color, so people are recognizable by their colour and a grid
 * of initials looks designed rather than empty. White text reads well on it.
 */
export function colorFromAddress(address: string): string {
  let h = 5381;
  for (let i = 0; i < address.length; i++) h = ((h << 5) + h + address.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 62%, 52%)`;
}
