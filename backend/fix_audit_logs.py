#!/usr/bin/env python3
"""
Script to fix all AuditLog constructor usages to use the AuditLog.log() method.
This ensures the `action` field (nullable=False) is properly set.
"""

import re
import sys

def read_file(filepath):
    """Read file contents."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    """Write content to file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def ensure_import(content, filepath):
    """Ensure get_jwt_identity is imported."""
    # Check if already imported
    if 'from flask_jwt_extended import get_jwt_identity' in content:
        return content

    # Find flask imports
    import_pattern = r'(from flask import [^\n]+)'
    match = re.search(import_pattern, content)

    if match:
        # Add after flask import
        import_line = match.group(0)
        new_import = '\nfrom flask_jwt_extended import get_jwt_identity\n'
        content = content.replace(import_line, import_line + new_import, 1)

    return content

def fix_audit_log_pattern(content, filepath):
    """Fix AuditLog constructor pattern to use AuditLog.log() method."""

    # Pattern to match:
    # log = AuditLog(
    #     action_type="...",
    #     action_details="..."
    # )
    # db.session.add(log)
    # db.session.commit()  (optional)

    pattern = r'(\s*)log = AuditLog\(\s*action_type="([^"]+)",\s*action_details=([^\)]+)\)\s*db\.session\.add\(log\)(?:\s*db\.session\.commit\(\))?'

    def replacement(match):
        indent = match.group(1)
        action_type = match.group(2)
        action_details = match.group(3).strip()

        # Remove surrounding quotes and f-string prefix from action_details
        action_details = action_details.strip('"\'')
        if action_details.startswith('f"') or action_details.startswith("f'"):
            action_details = action_details[2:-1]

        # Extract meaningful information for details dict
        details_value = '{"action": "performed"}'  # Default

        # Try to extract meaningful data from action_details
        if 'part_number' in action_details.lower():
            details_value = '{"performed": True}'

        new_code = f'''{indent}AuditLog.log(
{indent}    user_id=get_jwt_identity(),
{indent}    action="{action_type}",
{indent}    resource_type="general",
{indent}    details={details_value},
{indent}    ip_address=request.remote_addr
{indent})'''

        return new_code

    content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

    return content

def process_file(filepath):
    """Process a single file."""
    print(f"Processing {filepath}...")

    try:
        content = read_file(filepath)
        original_content = content

        # Ensure imports
        content = ensure_import(content, filepath)

        # Count occurrences before
        before_count = content.count('log = AuditLog(')

        if before_count == 0:
            print(f"  No instances found in {filepath}")
            return True

        print(f"  Found {before_count} instances to fix")
        print(f"  Note: This file needs MANUAL review and fixing")
        print(f"  The pattern is complex and requires understanding the context")
        return False

    except Exception as e:
        print(f"  ERROR processing {filepath}: {e}")
        return False

def main():
    """Main entry point."""
    files_to_fix = [
        'routes_chemicals.py',
        'routes_expendables.py',
        'routes_kit_messages.py',
        'routes_kit_reorders.py',
        'routes_kit_transfers.py',
        'routes_orders.py',
        'routes_password_reset.py',
        'routes_profile.py',
        'routes.py',
        'routes_rbac.py',
        'routes_tool_checkout.py',
        'routes_users.py'
    ]

    print("=" * 60)
    print("AuditLog Fix Script")
    print("=" * 60)
    print()

    needs_manual = []

    for filepath in files_to_fix:
        if not process_file(filepath):
            needs_manual.append(filepath)

    print()
    print("=" * 60)
    print("Summary:")
    print(f"  Total files: {len(files_to_fix)}")
    print(f"  Need manual fixing: {len(needs_manual)}")
    print()

    if needs_manual:
        print("Files needing manual review:")
        for f in needs_manual:
            print(f"  - {f}")

    print("=" * 60)

if __name__ == '__main__':
    main()
