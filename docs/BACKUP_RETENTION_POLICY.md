# Backup Retention Policy

## 1. Local Retention (On-Server)
To prevent disk exhaustion while allowing quick recovery:
- **Keep last 7 days** of backups in the `backup_data` volume.
- Automatic cleanup is handled by `master-backup.sh` using `find -mtime +7 -delete`.

## 2. Remote Retention (S3 Object Storage)
Long-term archival strategy:
- **Hourly Backups:** Retain for 24 hours.
- **Daily Backups:** Retain for 30 days.
- **Weekly Backups:** Retain for 3 months.
- **Monthly Backups:** Retain for 1 year.
- **Yearly Backups:** Retain for 3 years.

*Note: Retention in S3 should be managed via S3 Lifecycle Policies to optimize costs.*

## 3. Backup Frequency
- **Database:** Hourly
- **Files/Media:** Daily
- **Configuration:** Daily (included in Files backup)

## 4. Backup Integrity
- Backups are encrypted using AES-256-CBC.
- Verification should include periodic decryption and mounting of archives.
