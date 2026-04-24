"""GitHub issue creation for bug reports."""

import logging
from urllib.parse import quote

import requests


logger = logging.getLogger(__name__)

SEVERITY_LABELS = {
    "critical": "severity: critical",
    "high":     "severity: high",
    "medium":   "severity: medium",
    "low":      "severity: low",
}

GITHUB_API_BASE = "https://api.github.com"


def create_github_issue(report: dict, token: str, owner: str, repo: str) -> dict | None:
    """Create a GitHub issue for a bug report.

    Returns {"number": int, "html_url": str} on success, None on failure.
    Never raises — all errors are logged and swallowed so callers stay unblocked.
    """
    title = f"[Bug] {report.get('title') or 'Untitled'}"

    severity = report.get("severity") or "medium"
    reported_by = report.get("reported_by_name") or "Unknown"
    description = report.get("description") or ""
    steps = report.get("steps_to_reproduce") or ""
    page = report.get("page_context") or ""

    body_parts = [
        f"**Reported by:** {reported_by}",
        f"**Severity:** {severity.capitalize()}",
    ]
    if page:
        body_parts.append(f"**Page/Context:** {page}")
    body_parts.append("")
    body_parts.append("## Description")
    body_parts.append(description)
    if steps:
        body_parts.append("")
        body_parts.append("## Steps to Reproduce")
        body_parts.append(steps)
    body_parts.append("")
    body_parts.append("---")
    body_parts.append("*This issue was automatically created from a SupplyLine bug report.*")

    labels = ["bug"]
    if severity in SEVERITY_LABELS:
        labels.append(SEVERITY_LABELS[severity])

    payload = {
        "title": title,
        "body": "\n".join(body_parts),
        "labels": labels,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        resp = requests.post(
            f"{GITHUB_API_BASE}/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/issues",
            json=payload,
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 201:
            data = resp.json()
            return {"number": data["number"], "html_url": data["html_url"]}
        logger.warning(
            "GitHub issue creation failed: HTTP %s — %s",
            resp.status_code,
            resp.text[:200],
        )
        return None
    except Exception:
        logger.warning("GitHub issue creation raised an exception", exc_info=True)
        return None
