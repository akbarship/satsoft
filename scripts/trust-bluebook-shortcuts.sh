#!/usr/bin/env bash
# Ubuntu / GNOME: automatically mark Bluebook app shortcuts on the Desktop as trusted.
#
# Chrome creates every installed web app's Desktop shortcut as "untrusted"
# (grey icon with a red ✕). This installs a per-user watcher that trusts new
# shortcuts — only Chrome web-app shortcuts whose Name is exactly "Bluebook".
#
#   Install:    bash scripts/trust-bluebook-shortcuts.sh
#   Uninstall:  bash scripts/trust-bluebook-shortcuts.sh --uninstall
#
# Run it once per computer, as the user who takes the test (no sudo needed).
set -euo pipefail

DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
UNIT_DIR="$HOME/.config/systemd/user"
BIN="$HOME/.local/bin/trust-bluebook-shortcuts"
UNIT=trust-bluebook-shortcuts

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl --user disable --now "$UNIT.path" 2>/dev/null || true
  rm -f "$UNIT_DIR/$UNIT.path" "$UNIT_DIR/$UNIT.service" "$BIN"
  systemctl --user daemon-reload
  echo "Removed. Existing shortcuts keep their current trust state."
  exit 0
fi

mkdir -p "$UNIT_DIR" "$(dirname "$BIN")"

cat > "$BIN" <<EOF
#!/usr/bin/env bash
# Trust Chrome web-app shortcuts named "Bluebook" on the Desktop.
for f in "$DESKTOP_DIR"/chrome-*.desktop; do
  [ -f "\$f" ] || continue
  grep -qx 'Name=Bluebook' "\$f" || continue
  grep -q '^Exec=.*google-chrome.*--app-id=' "\$f" || continue
  chmod +x "\$f"
  gio set "\$f" metadata::trusted true
done
EOF
chmod +x "$BIN"

cat > "$UNIT_DIR/$UNIT.service" <<EOF
[Unit]
Description=Trust Bluebook web-app shortcuts on the Desktop

[Service]
Type=oneshot
ExecStart=$BIN
EOF

cat > "$UNIT_DIR/$UNIT.path" <<EOF
[Unit]
Description=Watch the Desktop for new Bluebook web-app shortcuts

[Path]
PathChanged=$DESKTOP_DIR

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT.path"
"$BIN"   # trust any shortcut that already exists

echo "Done. New Bluebook shortcuts on $DESKTOP_DIR will be trusted automatically."
