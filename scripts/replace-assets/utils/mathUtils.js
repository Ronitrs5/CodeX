function percentDiff(oldVal, newVal) {
  if (oldVal === 0) return 0;
  return Math.abs(((newVal - oldVal) / oldVal) * 100);
}

function bytesToKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

module.exports = { percentDiff, bytesToKB };
