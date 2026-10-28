# Backups

- `pg-backup.sh`: nightly `pg_dump -Fc`, piped straight into **age** (default) or **gpg**; retention 14 daily / 8 weekly / 6 monthly; optional `rclone` off-site sync.
- `restore-drill.sh`: decrypts a backup into a throwaway container, runs sanity checks, then removes it.

## Encryption options

| Option | Setup | Pros | Cons |
|---|---|---|---|
| **age** (recommended) | `age-keygen -o udigity-backup.agekey` on the Owner's machine; put only the `age1...` public key in `backup.env` | Tiny, no keyring, no expiry, fast | Single key file to guard |
| gpg | Import the public key on the server; set `GPG_RECIPIENT` | Familiar; supports smartcards/YubiKey | Keyring and trust handling; keys can expire |

Whatever you choose, the **private key never lives on the VPS**. Keep two offline copies (e.g. a password manager plus a USB stick in a safe). Without it the backups cannot be read.

Full runbook: `devops/README.md`.
