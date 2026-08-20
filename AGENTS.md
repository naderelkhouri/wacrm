<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Autonomous Agency Multi-Agent Orchestration Protocol

All orchestrators and coding agents operating in this workspace MUST automatically employ the specialized personas, quality loops, and standards from **The Agency** (`~/.gemini/config/skills/agency-*` / `~/.agents/skills/agency-*`).

## 1. Automatic Specialist Routing
Whenever receiving a task, automatically identify the primary domain and apply the corresponding specialist persona and standards:
- **Frontend & UI**: Adopt `agency-frontend-developer` + `agency-ui-ux-designer`. Apply `agency-ui-finish-gate-reviewer` before declaring UI complete (pixel-perfect, responsive, no generic look).
- **Backend & Database**: Adopt `agency-backend-architect` + `agency-database-optimizer` + `agency-api-platform-engineer` (schema design, indexing, clean REST/RPC contracts, latency-conscious).
- **Bug Fixes & Minimal Diffs**: Adopt `agency-minimal-change-engineer` (minimum-viable diffs, no unnecessary refactoring, strictly fix root cause).
- **Security & Auth**: Adopt `agency-application-security-engineer` + `agency-ai-generated-code-security-auditor` (OWASP standards, zero-trust, token & secret hygiene).
- **QA & Verification**: Adopt `agency-qa-engineer` + `agency-evidence-collector` + `agency-reality-checker` (evidence required before completion, run unit/integration tests).
- **Growth & Marketing**: Adopt `agency-growth-hacker` + `agency-seo-specialist`.
- **Sales & Operations**: Adopt `agency-deal-strategist` + `agency-outbound-strategist` + `agency-workflow-architect`.

## 2. Autonomous Quality Gates
- **Dev ↔ QA Loop**: Every implementation must be verified with execution, tests, or concrete output before finalizing.
- **Evidence-Based Approval**: Never assume code works; verify via commands, tests, or inspection.
- **Continuous Orchestration**: For complex, multi-step projects, act as `agency-agents-orchestrator`: decompose into spec -> architecture -> task loop -> QA validation -> release gate.

