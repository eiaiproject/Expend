# Security Policy

## Supported versions

The latest release on `main` is supported. Older releases receive fixes only
when the issue is severe and the upgrade path is not practical.

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository:

1. Open the Security tab.
2. Choose "Report a vulnerability".
3. Include affected version, browser, reproduction steps, and impact.

Do not open a public issue for a vulnerability. Do not include real transaction
data, backup files, or credentials in a report. Use synthetic data.

If private reporting is unavailable, contact the maintainers through their
GitHub profile and ask for a private channel before sharing details.

## Scope

In scope:

- Cross-site scripting or script injection in the app shell.
- Bypass of import validation, CSV sanitization, or file magic checks.
- Exposure of transaction data through the share cache or service worker.
- CSP or header regressions in `public/_headers`.
- Dependency vulnerabilities that affect the production bundle.
- Authentication or authorization issues, if an account system is added.

Out of scope:

- Access to data by someone who already controls the user's browser profile or
  operating system.
- Missing encryption at rest, which is a documented accepted risk in
  `docs/THREAT_MODEL.md`.
- Denial of service through unrealistic local file sizes beyond the documented
  limits.
- Reports that require modifying the user's device or disabling browser
  security controls.

## Response

- Acknowledge within 3 business days.
- Triage and agree on a disclosure timeline within 7 business days.
- Ship a fix for confirmed high-severity issues as soon as practical.
- Credit reporters in the release notes unless they prefer to stay anonymous.

## Safe harbor

Good-faith research that follows this policy, avoids privacy violations, and
does not degrade service will not be pursued legally. Stop testing and report
immediately if you encounter real user data.
