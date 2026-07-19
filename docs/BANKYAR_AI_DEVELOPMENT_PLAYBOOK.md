# BankYar: Enterprise AI Development Playbook & Prompt Engineering Standard
**Document Reference:** BY-AI-STD-1.0-LOCKED
**Classification:** Restricted – Internal Engineering Use Only
**Target Platform:** Android (Offline-First, Security-First, Privacy-First Personal Finance Platform)

---

## 1. Executive Summary

This document establishes the official **AI Development Playbook & Prompt Engineering Standard** for the BankYar project. As an offline-first, security-first, and privacy-first personal finance platform built with Flutter for Android, BankYar requires an absolute level of engineering rigor.

To achieve high velocity without compromising system integrity, BankYar adopts an **AI-First Development Strategy**. In this model, Artificial Intelligence is not merely an autocomplete tool; it is a core operational capability integrated across the entire Software Development Lifecycle (SDLC).

This playbook acts as the authoritative governing framework. It defines the rules of engagement between human engineers and AI agents, standardizes prompt structures, dictates strict verification workflows, provides mitigation paths for AI hallucinations, and establishes a formal quality gate matrix. By adhering to these standards, the BankYar engineering organization ensures that all AI-generated artifacts are highly structured, fully traceable, secure, compliant with the design system, and maintainable over the project's multi-decade lifecycle.

---

## 2. AI Development Philosophy

The BankYar engineering philosophy views AI as an accelerator that amplifies human creativity, analytical depth, and execution speed. Our philosophy is built on three core pillars:

1. **Human-in-the-Loop Supremacy:** AI proposes; humans validate, verify, and assume full accountability. AI holds no agency or legal/engineering responsibility for the code committed to the repository.
2. **Determinism via Structure:** LLM outputs are inherently probabilistic. To run an enterprise-grade software operation, we must wrap these probabilistic engines in deterministic quality gates, standardized templates, and formal verification pipelines.
3. **Traceability as a First-Class Citizen:** Every AI-generated design document, test suite, and architectural blueprint must map back to a verified prompt, which in turn maps back to a validated product requirement. There must be zero "magic" or untraceable code.

---

## 3. AI-First Engineering Principles

Our engineering principles guide how we interact with and design workflows around AI:

* **Principle of Explicit Context:** AI operates with high fidelity only when given precise, bounded, and structured context. Prompts must strictly enforce boundaries, inputs, and reference definitions.
* **Principle of Incremental Synthesis:** Large tasks must be broken down into discrete, manageable prompt-response cycles. Generating an entire subsystem in a single prompt is an anti-pattern.
* **Principle of Automated Validation:** Human review must always be augmented by automated syntactic and semantic checks (e.g., static analysis, compiler verification, security linters) before any artifact is integrated.
* **Principle of Semantic Continuity:** The taxonomy used in our product documentation, system design, prompts, and code must remain perfectly aligned. "Salon" is strictly "GamingCenter"; "Service" is strictly "GameStation"; "Booking" is strictly "Reservation"; for BankYar, financial entities (e.g., Accounts, Transactions, Budgets) must maintain a singular, unyielding vocabulary.

---

## 4. Human-AI Collaboration Model

The Human-AI collaboration model is structured around a "Co-Pilot and Commander" relationship:

```
+--------------------------------------------------------------+
|                     Human Commander                          |
|  - Defines Scope, Objectives & Product Rules                 |
|  - Selects and Authorizes Standardized Prompts               |
|  - Validates AI Proposals via Strict Quality Gates           |
+------------------------------+-------------------------------+
                               |
                               | (Executes Structured Prompt)
                               v
+------------------------------+-------------------------------+
|                        AI Co-Pilot                           |
|  - Synthesizes Code, Tests, and Technical Artifacts         |
|  - Identifies Edge Cases and Suggests Optimizations          |
|  - Conducts Draft Architectural Trade-off Analyses           |
+------------------------------+-------------------------------+
                               |
                               | (Returns Proposed Artifact)
                               v
+------------------------------+-------------------------------+
|                     Verification Pipeline                     |
|  - Automated Linting, Compiling, and Static Analysis        |
|  - Human Peer & Security Review                              |
+--------------------------------------------------------------+
```

1. **Initiation (Human):** The human engineer identifies the target task, retrieves the appropriate authorized prompt template, and populates the task-specific metadata and inputs.
2. **Execution (AI):** The AI processes the prompt within strict context boundaries and returns the proposed artifact.
3. **Validation (Automated & Human):** The generated output is run through the local development testbed (compilation, automated tests, linters, and security checks) followed by a physical inspection by the engineer.
4. **Refinement (Collaborative):** If corrections are needed, they are performed using targeted, structured follow-up prompts rather than manual hacking, keeping the generation history clean and reproducible.

---

## 5. AI Responsibility Matrix

To clarify roles and responsibilities, BankYar implements a RACI matrix (Responsible, Accountable, Consulted, Informed) for all AI-assisted actions:

| SDLC Phase / Artifact | Human Engineer | Lead Architect | AI Engine | QA Team | AI Governance Board |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Prompt Design & Auth** | R | A | C | I | A |
| **Architecture Blueprints**| R | A | R | C | I |
| **Database Schemas** | R | A | R | C | I |
| **Logic/Repositories** | R | I | R | C | I |
| **UI Components (Flutter)**| R | I | R | R | I |
| **Unit/Integration Tests** | R | I | R | A | I |
| **Security Audits** | R | A | R | R | I |
| **Documentation & Release**| R | I | R | I | I |

*Note: While the AI Engine is listed as 'R' (Responsible) for drafting, the Human Engineer is always 'R' for the final submission, and the Lead Architect or QA Team remains 'A' (Accountable) for system integrity.*

---

## 6. AI Capability Boundaries

AI assistance is highly effective but must be restricted to its verified boundaries to prevent architectural degradation:

* **Permitted Zones of Autonomy:**
  * Drafting repetitive boilerplate structures (e.g., data models, serializing/deserializing logic).
  * Writing comprehensive unit tests based on strict input-output specifications.
  * Generating markdown documentation, user guides, and draft release notes.
  * Refactoring local code blocks for optimization or readability under strict, human-defined constraints.
* **Prohibited Zones (Human Only):**
  * Final cryptographic protocol selection and implementation.
  * Direct modification of offline-first synchronization state-machine logic without prior manual mathematical modeling.
  * Establishing or changing security keys, secrets management architecture, or biometrics authorization policies.
  * Merging PRs or deploying code directly to production environments.

---

## 7. AI Usage Policy

This policy governs the operational boundaries of using AI inside BankYar:

1. **Zero-Trust Input Policy:** No customer-identifying data (PII), live database dumps, real private keys, or credentials may ever be sent to an AI tool. All inputs must be dummy data or structural mock templates.
2. **Authorized Model Usage:** Only enterprise-approved, secure AI model endpoints configured to guarantee data privacy (i.e., zero-retention and no-training on user data) may be used.
3. **No Direct Code Insertion:** Code generated by AI must never be copied directly into the main branch without undergoing the automated local build and human verification workflow.
4. **Mandatory Attributions:** Any file where more than 30% of the content was drafted by AI must include a structured metadata header linking to the prompt version used.

---

## 8. Prompt Engineering Principles

To ensure consistency, prompt engineering is treated as a software engineering discipline. Our prompts are designed on the following principles:

* **Role-Based Specialization:** Prompts must begin by assigning a hyper-specific, expert role to the AI to align its semantic space (e.g., "Principal Security Architect specialized in offline Android key storage").
* **Bounded Contextual Budgets:** Prompts must only contain files and context directly relevant to the current task. Overloading prompts with unnecessary codebase files degrades output precision.
* **Strict Negative Constraints ("Do Not"):** Prompts must explicitly list banned actions, patterns, or packages to prevent the AI from defaulting to standard public-web patterns that violate BankYar's offline-first architecture.
* **Executable Output Schemas:** All outputs must be requested in highly structured, easily parsable formats (such as raw Markdown code blocks with clean paths) to enable automated extraction and verification.

---

## 9. Prompt Structure Standard

Every prompt used in BankYar must strictly adhere to the following mandatory structure. Prompts failing to use this template are blocked by the pre-commit and CI validation sweeps.

```markdown
# ROLE
[Define a specific, expert persona with deep domain context.]

# MISSION
[State the exact high-level purpose of this session.]

# PROJECT CONTEXT
- Project Name: BankYar
- App Type: Offline-first Personal Finance Platform
- Platform: Android (Flutter)
- Core Rules: Security-first, Privacy-first, Local-first (SQLite/Drift, encrypted local state)

# CURRENT PHASE
[Define the current stage, e.g., Phase 3: Offline Data Synchronization Layer]

# OBJECTIVES
1. [Objective 1 - specific and measurable]
2. [Objective 2]

# CONSTRAINTS
- Strict Constraint 1 (e.g., "No external HTTP network packages can be imported here")
- Strict Constraint 2 (e.g., "Must conform perfectly to the BankYar Enterprise Design System")

# INPUTS
- [Reference to input models, mock structures, or design files]

# DEPENDENCIES
- [List specific local system dependencies, e.g., drift 2.0, flutter_secure_storage]

# DELIVERABLES
1. [Specific file payload 1 with target path]
2. [Specific file payload 2 with target path]

# ACCEPTANCE CRITERIA
- [Criterion 1]
- [Criterion 2]

# OUTPUT FORMAT
[Specify exactly how the code/document must be formatted. Standard is raw file block with path prefix.]

# VALIDATION CHECKLIST
- [ ] Compiler check passed
- [ ] Linter rules verified (no warnings)
- [ ] Encryption protocols audited

# SUCCESS CRITERIA
[Define the measurable outcome of a successful generation.]

# DO NOT
- Do not use [banned approach].
- Do not import [banned library].
- Do not invent requirements outside of the provided inputs.

# ASSUMPTIONS
- [State any architectural assumptions]

# REFERENCES
- [Link to specifications, docs/playenest-prd.md, Design System files]

# VERSION METADATA
- Prompt ID: PR-SEC-AUTH-001
- Version: 1.2.0
- Governance Stamp: APPROVED-SEC-BY
```

---

## 10. Prompt Naming Convention

Prompts must be saved in the repository as `.md` files and named using a strict, structured taxonomic hierarchy:

`[Scope]-[Module]-[Submodule]-[Action]-[ID].md`

* **Scope:**
  * `ARCH`: Architecture & Blueprinting
  * `CODE`: Core Source Code Generation
  * `TEST`: Test Suite Generation
  * `DOC`: Documentation & Markdown Output
  * `REFR`: Refactoring & Optimizations
  * `AUD`: Security, Accessibility & Compliance Audits
* **Module:** The major functional system (e.g., `SYNC`, `AUTH`, `DB`, `UI`, `REP` for Repositories).
* **Submodule:** The specific unit (e.g., `ENCRYPT`, `SYNC_ENGINE`, `BUDGET_WIDGET`).
* **Action:** The operational verb (e.g., `GENERATE`, `REFACTOR`, `AUDIT`, `MIGRATE`).
* **ID:** A sequential three-digit identifier (e.g., `001`, `002`).

*Example:* `CODE-DB-ENCRYPT-GENERATE-003.md`

---

## 11. Prompt Versioning Strategy

All prompts are tracked in Git and versioned using Semantic Versioning (SemVer) principles to maintain traceability:

```
  v [ MAJOR ] . [ MINOR ] . [ PATCH ]
        |             |             |
        |             |             +-- Trivial adjustment (phrasing, formatting)
        |             +---------------- Functional update (added dependency/constraint)
        +------------------------------ Structural rewrite (different model target/architecture change)
```

* **PATCH Changes (e.g., `1.0.0` -> `1.0.1`):** Small wording adjustments, correcting grammar in instructions, or adding minor clarifying assumptions that do not change the code schema output.
* **MINOR Changes (e.g., `1.0.1` -> `1.1.0`):** Adding a new constraint, updating package dependencies, or adjusting acceptance criteria to align with a minor product change.
* **MAJOR Changes (e.g., `1.1.0` -> `2.0.0`):** Rewriting the prompt core structure, changing the assigned AI role, or updating the output schema to support a new architecture.

---

## 12. Prompt Documentation Standard

Every prompt in the prompt registry must be accompanied by a structured header block. This block serves as the metadata record used by both humans and AI governance engines to index and query our automation capabilities.

```markdown
---
id: CODE-UI-ACCOUNT_FORM-GENERATE-012
title: Account Creation Form Generator
version: 1.4.0
author: Jane Doe (Principal UI Architect)
approved_by: John Smith (Lead Security Architect)
date_created: 2024-10-15
last_modified: 2024-11-20
target_llm_capabilities: [Structured Coding, Design System Adherence]
associated_requirements: [REQ-UI-042, REQ-SEC-109]
change_log:
  - "1.4.0: Added security constraints to sanitize text fields locally before state commit."
  - "1.0.0: Initial release matching Enterprise Design System."
---
```

---

## 13. Prompt Review Process

Prompts are treated as source code and must undergo a formal peer review before being merged into the master prompt registry.

```
+-------------------+      +-------------------+      +--------------------+
|                   |      |                   |      |                    |
|  Draft Prompt     | ---> |  PR with Prompt   | ---> |  Automated Linter  |
|  in local branch  |      |  & Sample Output  |      |  & Metadata Check  |
|                   |      |                   |      |                    |
+-------------------+      +-------------------+      +--------------------+
                                                                |
                                                                v
+-------------------+      +-------------------+      +--------------------+
|                   |      |                   |      |                    |
|  Merged & Indexed  | <--- |  Lead Architect   | <--- |  Human Peer        |
|  in Registry      |      |  Approval (Stamps)|      |  Review (Audit)    |
|                   |      |                   |      |                    |
+-------------------+      +-------------------+      +--------------------+
```

1. **Submission:** The engineer submits a Pull Request containing the new or modified prompt file under `prompts/` along with a verified execution sample.
2. **Metadata Verification:** CI runs a script to ensure the prompt has valid front-matter metadata, conforms to the file naming convention, and includes all 17 structural elements from the template.
3. **Peer Review:** A human reviewer evaluates the prompt for precision, checking if the constraints are tight enough to avoid security gaps or architectural drift.
4. **Validation Test:** The reviewer runs the prompt against an approved offline-first testbed to verify the generation quality.

---

## 14. Prompt Approval Workflow

No prompt may be labeled as `APPROVED` or used in production-level generation unless it carries a validation stamp from the designated authorities:

* **Security Prompts:** Must receive a signed review from the Security Lead.
* **Architecture Prompts:** Must receive a signed review from the Principal Enterprise Architect.
* **UI/UX Prompts:** Must receive a signed review from the Lead Design System Architect.

The approval is represented in the front-matter metadata by appending the unique identifier of the approver and the cryptographic commit hash of the approved state:
`status: APPROVED-SEC-BY-0498a3b`

---

## 15. Prompt Repository Organization

The prompt registry is organized systematically within the root directory of the project, completely isolated from runtime application code:

```
bankyar-root/
├── docs/
│   └── BANKYAR_AI_DEVELOPMENT_PLAYBOOK.md (This File)
├── prompts/
│   ├── README.md                      # Index of all active prompts
│   ├── ARCH/                          # Architectural and blueprint prompts
│   │   ├── ARCH-DB-SCHEMA-001.md
│   │   └── ARCH-SYNC-ENGINE-002.md
│   ├── CODE/                          # Source code generation prompts
│   │   ├── CODE-DB-REPOS-001.md
│   │   ├── CODE-UI-COMP-002.md
│   │   └── CODE-AUTH-CIPHER-003.md
│   ├── TEST/                          # Test suite generation prompts
│   │   ├── TEST-UNIT-REPOS-001.md
│   │   └── TEST-INTEG-SYNC-002.md
│   ├── DOC/                           # Documentation and guides prompts
│   │   └── DOC-RELEASE-NOTES-001.md
│   ├── AUD/                           # Audit, compliance and check prompts
│   │   ├── AUD-SECURITY-001.md
│   │   └── AUD-ACCESSIBILITY-002.md
│   └── REFR/                          # Refactoring and optimization prompts
│       └── REFR-SQL-PERF-001.md
```

---

## 16. Prompt Metadata Standard

Every prompt file must declare its properties clearly to support programmatic classification and indexing:

* `id` (String): Unique identifier conforming to the naming standard.
* `tags` (Array): Categorization keywords (e.g., `[offline-sync, sqlite, drift]`).
* `intended_models` (Array): List of LLM capability profiles optimized for this prompt.
* `license` (String): Standard corporate license indicator.
* `max_tokens` (Integer): The recommended limit to set for the response generation to prevent incomplete code segments.
* `temperature` (Float): Suggested sampling temperature (e.g., `0.0` for rigid code, `0.3` for general logic, `0.7` for documentation writing).

---

## 17. Prompt Quality Metrics

Prompts are monitored and graded using objective quality metrics to continuously improve their performance:

$$\text{Prompt Precision Rate (PPR)} = \frac{\text{Successful Generations}}{\text{Total Prompt Executions}} \times 100$$

* **Target Benchmarks:**
  * **PPR (Prompt Precision Rate):** Must exceed 85% on first-run output.
  * **Code Compilation Rate (CCR):** Over 90% of code generated using CODE-class prompts must compile with zero errors on the first attempt.
  * **Linter Compliance Rate (LCR):** Less than 2 styling or static analysis violations per 100 lines of generated code.
  * **Review Overhead Ratio (ROR):** The time spent correcting AI output divided by the total generation time must remain under 15%.

---

## 18. Prompt Validation Rules

Before any prompt is checked into the registry, it is validated against the following semantic rules:

1. **Rule of Single Responsibility:** A prompt must focus on generating a single logical unit. If a prompt attempts to write both database logic and a UI widget simultaneously, it must be rejected.
2. **Rule of Explicit Negation:** Every CODE-class prompt must contain a `# DO NOT` section with at least three concrete, negative constraints.
3. **Rule of Mock Containment:** Any prompt requiring database or API context must contain inline, mock representations of those layers rather than relying on external network definitions.

---

## 19. Prompt Testing Strategy

Prompts are subject to automated validation sweeps before deployment:

* **Dry-Run Auditing:** The prompt is executed three separate times against the target LLM under standard settings.
* **Deterministic Output Assertions:** The outputs are parsed programmatically to check for:
  * Presence of forbidden terms (e.g., verifying that direct HTTP imports are completely absent if banned).
  * Structure completeness (verifying that all requested classes and methods exist).
  * Compliance with the design system tokens.
* **Variance Scoring:** If the code structure deviates heavily between the three runs, the temperature parameter is reduced until the outputs show consistent, reliable structures.

---

## 20. Prompt Regression Testing

When an underlying LLM engine version is updated, a regression sweep is performed across the entire prompt registry:

1. **Baseline Freeze:** The approved output for each registered prompt is stored as a reference baseline in `prompts/baselines/`.
2. **Execution Sweep:** A regression script executes all prompts using the updated model.
3. **Semantic Diffing:** An automated diffing tool compares the newly generated code against the baseline.
4. **Validation:** If the semantic diff reveals broken structures, missing security guards, or design system drift, the prompt is marked as `DRAFT-REGRESSED` and quarantined until adjusted.

---

## 21. AI Output Validation

To prevent unverified code from corrupting BankYar's repository, all AI outputs must undergo a multi-layered verification sequence:

```
[AI Output Generated]
        │
        ▼
┌────────────────────────┐
│   Automated Linter     │  --> Fails: Reject & Regenerate
└──────────┬─────────────┘
           │ Passes
           ▼
┌────────────────────────┐
│  Compiler Verification │  --> Fails: Log Errors, Feed to Refiner
└──────────┬─────────────┘
           │ Passes
           ▼
┌────────────────────────┐
│   Unit Test Runner     │  --> Fails: Quarantine & Fix
└──────────┬─────────────┘
           │ Passes
           ▼
┌────────────────────────┐
│  Human Code Review     │  --> Fails: Reject & Annotate
└──────────┬─────────────┘
           │ Approved
           ▼
[Merged to Main Repository]
```

Every generated artifact must be marked as validated by checking off the verification metrics, ensuring that compilation succeeds and test coverage remains unaffected.

---

## 22. Artifact Review Workflow

Every AI-generated file must be submitted via a standardized Pull Request template specifying the role of the AI. The review workflow requires:

1. **Origin Identification:** The PR description must explicitly list all files that were initiated or modified by an AI co-pilot.
2. **Prompt Reference:** A direct link to the prompt used from the registry must be provided.
3. **Visual Proof:** If UI components are generated, screenshots or automated visual regression test results must be attached.
4. **Verification Log:** Execution logs from the linter and unit tests must be embedded in the PR comments.

---

## 23. Code Generation Rules

To ensure code maintainability, the generation of core Flutter and Dart layers must strictly adhere to these architectural requirements:

* **Separation of Concerns:** Keep business logic completely separated from UI presentation layers. Use standard repositories to abstract all database operations.
* **State Management Isolation:** State transitions must be explicit and deterministic. State classes must be immutable and only modified via well-defined event handlers.
* **Robust Error Handling:** Zero empty catch blocks are allowed. All database transactions must run inside clean try-catch enclosures with safe, offline-friendly fallback paths.
* **Asynchronous Safety:** Async-await blocks must handle local resource timeouts safely, preventing UI freezes or database deadlocks.

---

## 24. Architecture Generation Rules

When using AI to draft technical designs or architecture blueprints, these structural principles are mandatory:

1. **Offline-First Resilience:** The system must assume that network connectivity is unavailable by default. Every feature must be designed to persist its state locally in SQLite/Drift before attempting any synchronization.
2. **Encryption at Rest:** All personal and financial data stored in SQLite must be encrypted transparently at the database layer using secure key management.
3. **Low-Memory Footprint:** Widgets and data streams must be memory-efficient. Avoid large, unpaged lists in memory; database operations must support clean pagination.

---

## 25. Documentation Generation Rules

AI-generated documentation must remain professional, precise, and highly readable:

* **Clear and Concise Language:** Use direct, active voice. Avoid fluff, unnecessary marketing language, or excessive jargon.
* **Interactive Code Fences:** All code snippets in documentation must specify the precise language and remain functionally accurate.
* **Standardized Metadata Headers:** Every document must feature an ownership header, author details, and version metadata.
* **Auto-Generated Warnings:** Ensure that draft documents are prominently marked with `[AI-Drafted]` notices until reviewed and approved by a human engineer.

---

## 26. Test Generation Rules

Testing is the primary safety net for AI-first development. AI-generated test files must follow these strict guidelines:

* **Hermetic Environment:** Tests must run locally without external network or file-system dependencies. All external calls must be mocked explicitly.
* **Boundary Condition Focus:** Write specific test cases for negative limits, empty lists, extreme numeric inputs, and broken sync payloads.
* **AAA Pattern Adherence:** Every test must be clearly divided into **Arrange**, **Act**, and **Assert** sections.
* **Code Coverage Maintenance:** Generated tests must maintain or improve overall project code coverage. If a feature is generated without matching tests, the pre-commit gates will reject the build.

---

## 27. Refactoring Rules

When refactoring code using AI, the following guardrails are strictly enforced:

1. **Functional Equivalence:** Refactoring must never change the external behavior of the code. Only optimizations for speed, memory, or readability are permitted.
2. **Parallel Testing:** Before refactoring, ensure that full unit test coverage is present. Run the exact same test suites after the refactor is applied to confirm zero functional regressions.
3. **Size Limitation:** Refactoring operations must be restricted to a single class or module at a time. Multi-module refactoring prompts are strictly prohibited.

---

## 28. Security Validation Rules

BankYar is security-first. AI-generated code must pass the following security checks:

* **Local Sanitization:** All user inputs must be validated and sanitized locally before database entry to prevent SQL injection or corrupt states.
* **Zero Secrets in Source:** No API keys, development passwords, or encryption seeds may be hardcoded into generated files. Secure configuration stores must be referenced instead.
* **Strict Cryptography:** Ensure that modern, standard cryptographic practices are used. Legacy algorithms (e.g., MD5, SHA-1) are strictly banned for security-sensitive operations.

---

## 29. Privacy Validation Rules

BankYar is privacy-first. AI-generated structures must maintain strict compliance with user privacy policies:

1. **Local Processing:** Financial transactions and personal budgets must be processed and stored entirely on the device.
2. **No Silent Analytics:** Analytics or diagnostic systems must never capture sensitive transaction details, account balances, or credentials.
3. **Transparent Data Erasure:** The database layer must support a verified, physical "purge" function that completely overwrites and deletes all local databases when requested by the user.

---

## 30. Accessibility Validation Rules

To provide a high-quality experience for all users, generated UI components must meet strict accessibility standards:

* **Semantic Labels:** All interactive elements and visual icons must include appropriate semantic accessibility labels for screen readers.
* **Contrast and Resizing:** UI components must support flexible layouts that handle system-level text resizing gracefully without breaking.
* **Minimum Tap Target Size:** Ensure all interactive touch elements (buttons, inputs) maintain a minimum target area of 48x48 logical pixels.

---

## 31. Design System Compliance

All AI-generated user interface elements must conform perfectly to the **BankYar Enterprise Design System**:

1. **Token Adherence:** UI code must use standard system design tokens for colors, spacing, and typography. Handcoded hex values or raw spacing constants are strictly rejected.
2. **Responsive Layouts:** Widgets must dynamically adapt to different Android screen resolutions and orientations using standard layout constraints.
3. **Theme Consistency:** UI components must support both Light and Dark modes seamlessly using the design system's unified theme providers.

---

## 32. Coding Standard Compliance

Generated code must integrate smoothly into the existing BankYar codebase by following our standard coding practices:

* **Immutable Data Models:** Use immutable declarations (`final` fields) for all data models and state management structures.
* **Type Safety:** Always declare explicit types for method arguments and return structures. Avoid using dynamic, untyped declarations.
* **Self-Documenting Code:** Choose clear, descriptive names for classes and methods. Comments should focus on explaining **why** complex logic is written rather than **what** the code is doing.

---

## 33. Risk Management

The use of AI introduces specific operational risks that require clear mitigation paths:

| Risk Identified | Severity | Probability | Core Mitigation Protocol |
| :--- | :---: | :---: | :--- |
| **Architectural Drift** | High | Medium | Use restricted context prompts and mandate architectural review gates before integration. |
| **Security Vulnerabilities**| Critical | Low | Run automated security scanners and require lead security engineer approval on security-sensitive code. |
| **API Drift** | High | High | Run continuous API verification comparing runtime code to the frozen OpenAPI specification. |
| **Dependency Bloat** | Medium | Medium | Maintain an explicit list of approved packages in the prompt constraints, blocking all unauthorized libraries. |

---

## 34. Hallucination Detection Strategy

AI engines occasionally invent APIs, dependencies, or structural designs. We detect and isolate these hallucinations using these strategies:

* **Strict Dependency Validation:** The build pipeline checks all import statements in generated code against a local registry of approved packages.
* **Compiler Isolation:** Build new modules in isolation first. If the code relies on nonexistent library classes or methods, compilation will fail instantly.
* **API Route Auditing:** Runtime route scanners verify that generated service interfaces align perfectly with the defined API contracts.

---

## 35. Fact Verification Workflow

When AI designs technical systems or analyzes logs, engineers must run all claims through this verification workflow:

1. **Source Tracking:** Locate the specific section in the product specification or design system document that supports the AI's proposal.
2. **Peer Verification:** Verify any complex architectural claims with a senior team member or technical lead.
3. **Empirical Verification:** Build a minimal, isolated testbed to confirm that the suggested approach works exactly as described under target platform conditions.

---

## 36. Traceability Model

We maintain perfect traceability between our product requirements, prompt history, and the codebase:

```
┌──────────────────────────┐
│   Product Requirement    │  (e.g., REQ-SYNC-001: Offline Sync)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Standard Prompt File    │  (e.g., CODE-DB-SYNC-GENERATE-002)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Generated Artifact     │  (With version metadata and hash in header)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Automated Verification  │  (Build & Test logs tied to commit)
└──────────────────────────┘
```

This model ensures that every lines of code can be traced back to its underlying design decisions and source requirements.

---

## 37. Context Management Strategy

To maximize generation quality, prompts must utilize the following context budgeting strategies:

* **Targeted Context Injection:** Only include files that are directly related to the current task. Do not feed the entire project directory into the AI.
* **Interface-Only Context:** When a module interacts with other systems, only pass the abstract interface definitions rather than the full implementation files. This keeps the prompt focused and efficient.
* **Periodic Session Reset:** Clear the chat history and start fresh sessions regularly to prevent old, outdated context from degrading output quality.

---

## 38. Knowledge Preservation

Engineering insights must be captured and structured to maintain long-term team knowledge:

1. **ADR (Architecture Decision Records):** All key architectural decisions are documented as clean markdown files under `docs/adr/`.
2. **Prompt Optimization Logging:** When a prompt constraint is modified to resolve a code generation issue, the details must be logged in the prompt's changelog.
3. **Standardized Post-Mortems:** Any issue caused by AI-generated code must be analyzed in a structured post-mortem document to prevent similar failures in the future.

---

## 39. Decision Logging

All technical architecture decisions made with AI support must be recorded using this standard ADR format:

```markdown
# ADR-[ID]: [Title]
- **Date:** [YYYY-MM-DD]
- **Status:** [Proposed / Accepted / Superseded]
- **Authors:** [Name]
- **AI Contribution Profile:** [Prompt ID used, refinement history]

## Context
[Describe the problem context and architectural requirements.]

## Decision
[State the exact architectural choice made.]

## Consequences
- **Positive:** [Beneficial outcomes]
- **Negative:** [Trade-offs and architectural debt]
```

---

## 40. AI Failure Recovery Strategy

When AI-generated code fails validation, compilation, or testing, engineers must apply the following recovery workflow:

* **Step 1: Failure Classification:** Categorize the error (e.g., compilation error, logical bug, styling violation).
* **Step 2: Automated Feedback Loop:** Feed the exact error output back to the refiner prompt to generate an optimized version.
* **Step 3: Human Intervention:** If the second refinement run fails, the engineer must step in, take over the code block manually, and log the failure details in the prompt registry to optimize future constraints.

---

## 41. Governance Rules

The BankYar engineering organization is governed by these core rules:

1. **No Unreviewed AI Commits:** Every AI-assisted change must undergo standard human peer review before integration.
2. **Traceable Prompt Registry:** All prompts used in the development lifecycle must be version-controlled in the repository.
3. **No Hallucinated Requirements:** AI must never invent features or change system behavior outside the scope of verified product specifications.
4. **Design System Adherence:** Handcoded visual elements or styling overrides are strictly forbidden; components must use design system tokens.

---

## 42. KPIs & Metrics

Our AI integration success is measured using these key metrics, reviewed monthly by the AI Governance Board:

* **Velocity Acceleration Index (VAI):** The speed of feature delivery compared to human-only baselines. Target: $>1.5\text{x}$ increase.
* **Code Defect Density (CDD):** The number of post-merge issues per thousand lines of AI-assisted code. Target: $<0.5$ bugs.
* **Prompt Registry Coverage:** The percentage of development tasks supported by approved prompts in the registry. Target: $>75\%$.
* **Security Sweep Pass Rate:** The percentage of AI-generated code blocks that pass automated security audits on the first run. Target: $100\%$.

---

## 43. Continuous Improvement Process

Our engineering standards undergo continuous improvement through a regular refinement process:

```
[Prompt Execution] ──> [Performance Metric Review] ──> [Post-Mortem Analysis]
         ▲                                                       │
         │                                                       ▼
[Registry Update] <──────── [Constraint Optimization] <──────────┘
```

This cycle ensures our prompt registry remains optimized, highly precise, and perfectly aligned with our evolving technical stack.

---

## 44. Anti-pattern Catalog

We actively monitor and avoid these common AI integration anti-patterns:

* **The Lazy Engineer:** Relying blindly on AI outputs without reviewing code correctness or security guardrails.
* **Context Overloading:** Injecting entire directories of irrelevant source code into the prompt, leading to high token costs and lower precision.
* **The Single-Prompt Subsystem:** Attempting to build complete features or complex modules using a single prompt.
* **Custom Token Injection:** Bypassing design system constants to write custom UI styling.

---

## 45. Future AI Evolution Strategy

To remain future-proof, BankYar's AI development standards are model-independent and designed to adapt to future technologies:

* **Model Agnostic Interfaces:** Prompts are structured semantically, ensuring they remain compatible with any modern, high-capability LLM.
* **Agentic Orchestration Preparation:** The strict input/output definitions used in our templates are ready to integrate with automated multi-agent systems when they reach enterprise maturity.
* **Standardized Benchmarking:** Regular evaluation sweeps ensure our prompt registry is continually optimized to leverage the strengths of next-generation models.

---

*This specification is signed and locked for Phase 9 of the BankYar project.*
**AI Governance Officer:** *Signed electronically*
**Software Quality Architect:** *Signed electronically*