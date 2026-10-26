# Play-Nest Analytics Phase 7 — Privacy & Disclosure Security Review

## 1. Threat Model & Privacy Analysis

### Threat Scenarios Evaluated
1. **Competitor Metric Inversion (Self-Subtraction Attack)**:
   - *Risk*: A tenant subtracts their known contribution from a reported aggregate to isolate a specific competitor's metric.
   - *Defense Implemented*: The target tenant's own data is explicitly excluded from the peer cohort aggregate ($k \ge 5$ peer tenants only).
2. **Small-Cohort Disclosures ($k$-Anonymity Violation)**:
   - *Risk*: When only 1–4 competitors exist in a category or region, aggregates reveal single-competitor performance.
   - *Defense Implemented*: Strict $k \ge 5$ suppression rule. If $k < 5$, status `SUPPRESSED` is returned and metric values are set to `null`.
3. **Cross-Tenant Authorization & Enumeration Attacks**:
   - *Risk*: A malicious manager attempts to pass another tenant's `gamingCenterId` to inspect raw or aggregate data.
   - *Defense Implemented*: `tenantGuard` middleware validates `actor.gamingCenterId === params.gamingCenterId`. Rejects mismatched attempts with HTTP 404 Not Found (Enumeration Defense).
4. **Customer PII Exposure**:
   - *Risk*: Customer phone numbers or personal identities leaked through benchmarking/growth metrics.
   - *Defense Implemented*: Benchmarks operate exclusively on decoupled aggregate statistics. Individual customer accounts are unidentifiable. Phone numbers in top spender lists remain masked (`0912***1234`).

---

## 2. Privacy Control Matrix

| Control | Mechanism | Verification Method | Status |
|---|---|---|---|
| **$k$-Anonymity** | Minimum 5 peer tenants required | `analytics.benchmarks.spec.ts` | **PASS** |
| **Self-Exclusion** | Target tenant excluded from peer aggregate | `analytics.benchmarks.spec.ts` | **PASS** |
| **Tenant Boundary** | `tenantGuard` HTTP 404 response | `analytics.api.spec.ts` | **PASS** |
| **PII Masking** | `maskPhoneNumber` helper | `analytics.customers.spec.ts` | **PASS** |
| **Kill Switch** | `ENABLE_ANALYTICS_BENCHMARKING` flag | `analytics.benchmarks.spec.ts` | **PASS** |

---

## 3. Residual Risks & Governance Recommendations
- **Sparse Regions**: In geographic or category segments with fewer than 5 active gaming centers, benchmarking will remain suppressed until tenant adoption increases.
- **Monitoring**: Log all benchmark requests for audit purposes and monitor suppression frequency.
