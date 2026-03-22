export function auditLog(action, target, ip, success, detail = '', user = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    action, target, ip, success,
    ...(user && { user }),
    ...(detail && { detail }),
  };
  console.log(JSON.stringify(entry));
}
