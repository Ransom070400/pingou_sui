/**
 * Session-scoped set of peer addresses we've already shown a "Connected!" popup
 * for. Lets the scanner (which pops immediately on the active device) and the home
 * poll (which pops on the SCANNED device) avoid double-announcing the same
 * connection on the scanner's own device.
 */
const announced = new Set<string>();

export const wasAnnounced = (address: string) => announced.has(address);
export const markAnnounced = (address: string) => {
  announced.add(address);
};
