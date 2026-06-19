# Storage Requirements Estimation

## 1. Data Components
- **Database (PostgreSQL):** ~100MB initial, growing ~10-20MB/month (compressed).
- **Media/Uploads:** Variable, estimated ~1GB initial, growing ~500MB/month.
- **Configuration/Logs:** Negligible (< 10MB).

## 2. Calculation (Monthly Projection)
Assuming 30 daily backups and 12 monthly backups:

### 2.1. Local Storage (7 days)
- DB: 7 * 100MB = 700MB
- Files: 7 * 1GB = 7GB
- **Total Local:** ~7.7GB

### 2.2. Remote Storage (S3 - 1 Year)
- Daily DB: 30 * 100MB = 3GB
- Monthly DB: 12 * 100MB = 1.2GB
- Daily Files: 30 * 1GB = 30GB
- Monthly Files: 12 * 1GB = 12GB
- **Total Remote:** ~46.2GB (Year 1)

## 3. Recommendations
- Use **S3 Intelligent-Tiering** to move older backups to cheaper storage (Glacier Instant Retrieval).
- Monitor `backup_data` volume usage to ensure it doesn't exceed 80% capacity.
