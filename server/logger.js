export function auditLog(action, target, ip, success, detail = '') {
  const entry = {
    timestamp: new Date().toISOString(),
    action, target, ip, success,
    ...(detail && { detail }),
  };
  console.log(JSON.stringify(entry));
}
