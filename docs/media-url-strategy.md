# Media URL strategy (frontend)

## Overview

The backend stores media files via a storage adapter (local disk or S3). Media records (`GamingCenterMedia`) store:

- `url`: the original asset URL.
- `thumbUrl`: a thumbnail URL for images (generated on upload).

The frontend should treat these URLs as opaque strings and **not** attempt to build them manually.

## URL shapes

### Local storage

```
{MEDIA_PUBLIC_BASE_URL}{MEDIA_LOCAL_PUBLIC_PATH}/{storageKey}
```

Example:

```
http://localhost:3000/media/gamingCenters/{gamingCenterId}/media/original/{uuid}.jpg
```

### S3 storage

If `MEDIA_PUBLIC_BASE_URL` is provided, URLs are based on that host. Otherwise the default public
S3 URL format is used:

```
https://{bucket}.s3.{region}.amazonaws.com/{storageKey}
```

Uploads expect a presigned URL template to be provided via `MEDIA_S3_UPLOAD_URL_TEMPLATE`, with
`{key}` as the placeholder (e.g. `https://bucket.s3.region.amazonaws.com/{key}?signature=...`).

## Frontend usage

- Use `thumbUrl` when available for gallery previews or grid layouts.
- Fall back to `url` if `thumbUrl` is missing (e.g., non-image media types).
- URLs are cacheable and immutable (new uploads generate new keys).
