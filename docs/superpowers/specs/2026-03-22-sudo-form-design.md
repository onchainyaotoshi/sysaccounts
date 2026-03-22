# Sudo Grant Form Overhaul — Design Spec

## Goal

Replace the sudo grant form's manual text inputs with user-friendly select dropdowns for both username and rule fields.

## Changes

### Username field
- Replace `<input>` text with `<select>` dropdown
- Fetch user list via `api.getUsers()` when modal opens
- Filter to non-system users only (uid >= 1000)

### Rule field
- Replace `<input>` text with `<select>` dropdown with 7 preset options:
  1. "Full sudo access" → `ALL=(ALL) ALL`
  2. "Full sudo (no password)" → `ALL=(ALL) NOPASSWD: ALL`
  3. "Package management" → `ALL=(ALL) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/bin/dpkg`
  4. "Service management" → `ALL=(ALL) NOPASSWD: /usr/bin/systemctl`
  5. "Docker" → `ALL=(ALL) NOPASSWD: /usr/bin/docker`
  6. "Reboot/shutdown" → `ALL=(ALL) NOPASSWD: /usr/sbin/reboot, /usr/sbin/shutdown`
  7. "Custom rule" → shows text input below

### Custom rule
- When "Custom rule" is selected, a text input appears below the dropdown
- Helper text: `Format: ALL=(ALL) NOPASSWD: /path/to/command`
- Link: "Learn sudoers rule format" → https://www.sudo.ws/docs/man/sudoers/

### Behavior
- Default username: first user in list
- Default rule: "Full sudo access"
- Selecting "Custom rule" shows text input, default empty
- Submit sends the matching rule string to `api.grantSudo()`
- No backend changes — rule format is the same

## Files
- Modify: `client/src/components/SudoersList.jsx`

## Out of Scope
- No backend changes
- No new API endpoints
- No changes to other forms
