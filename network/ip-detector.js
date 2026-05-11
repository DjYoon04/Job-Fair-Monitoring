// network/ip-detector.js
// Dynamically detects the local LAN IP address of this machine.
// Falls back gracefully if no network interface is found.

const os = require('os');

/**
 * Returns the best local LAN IPv4 address (e.g. 192.168.x.x or 10.x.x.x).
 * Skips loopback (127.x) and link-local (169.254.x) addresses.
 * @returns {string} IP address string, or '127.0.0.1' as fallback
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [ifaceName, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&                        // skip loopback
        !addr.address.startsWith('169.254.')     // skip link-local
      ) {
        candidates.push({ name: ifaceName, address: addr.address });
      }
    }
  }

  if (candidates.length === 0) {
    console.warn('[IP] No external IPv4 interface found. Falling back to 127.0.0.1');
    return '127.0.0.1';
  }

  // Prefer typical LAN ranges: 192.168.x.x > 10.x.x.x > 172.16-31.x.x > other
  const priority = (ip) => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.'))      return 1;
    const second = parseInt(ip.split('.')[1], 10);
    if (ip.startsWith('172.') && second >= 16 && second <= 31) return 2;
    return 3;
  };

  candidates.sort((a, b) => priority(a.address) - priority(b.address));

  const chosen = candidates[0].address;
  console.log(`[IP] Detected LAN IP: ${chosen} (interface: ${candidates[0].name})`);
  return chosen;
}

/**
 * Returns ALL available LAN IPv4 addresses (useful for display/debug).
 * @returns {Array<{name: string, address: string}>}
 */
function getAllLocalIPs() {
  const interfaces = os.networkInterfaces();
  const result = [];

  for (const [ifaceName, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        result.push({ name: ifaceName, address: addr.address });
      }
    }
  }

  return result;
}

module.exports = { getLocalIP, getAllLocalIPs };
