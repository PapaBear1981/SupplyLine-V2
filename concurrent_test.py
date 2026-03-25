#!/usr/bin/env python3
"""
Concurrent User Performance Test for SupplyLine V2
Tests for race conditions, session conflicts, data collisions, and auth issues
"""

import requests
import threading
import time
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "http://localhost:8081/api"
RESULTS = {
    "total_users": 0,
    "successful_logins": 0,
    "failed_logins": 0,
    "successful_requests_created": 0,
    "failed_requests_created": 0,
    "successful_updates": 0,
    "failed_updates": 0,
    "errors": [],
    "race_conditions": [],
    "session_conflicts": [],
    "auth_issues": [],
    "data_collisions": [],
    "timing": {}
}

RESULTS_LOCK = threading.Lock()

def log(msg):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {msg}")

def concurrent_user_test(user_id):
    """Simulate a single user going through the full flow"""
    user_results = {
        "user_id": user_id,
        "login_success": False,
        "token": None,
        "requests_created": [],
        "errors": [],
        "start_time": time.time()
    }
    
    session = requests.Session()
    
    try:
        # Step 1: Login
        login_start = time.time()
        login_resp = session.post(
            f"{BASE_URL}/auth/login",
            json={
                "employee_number": "ADMIN001",
                "password": "admin123"
            },
            timeout=10
        )
        login_time = time.time() - login_start
        
        with RESULTS_LOCK:
            RESULTS["timing"][f"user_{user_id}_login"] = login_time
        
        if login_resp.status_code == 200:
            data = login_resp.json()
            user_results["login_success"] = True
            user_results["token"] = data.get("access_token")
            
            with RESULTS_LOCK:
                RESULTS["successful_logins"] += 1
            
            log(f"User {user_id}: Login OK ({login_time:.3f}s)")
        else:
            with RESULTS_LOCK:
                RESULTS["failed_logins"] += 1
                RESULTS["auth_issues"].append(f"User {user_id}: Login failed {login_resp.status_code} - {login_resp.text}")
            user_results["errors"].append(f"Login failed: {login_resp.status_code}")
            log(f"User {user_id}: Login FAILED ({login_resp.status_code})")
            return user_results
        
        headers = {"Authorization": f"Bearer {user_results['token']}"}
        
        # Step 2: List existing requests
        list_start = time.time()
        list_resp = session.get(f"{BASE_URL}/user-requests", headers=headers, timeout=10)
        list_time = time.time() - list_start
        
        with RESULTS_LOCK:
            RESULTS["timing"][f"user_{user_id}_list"] = list_time
        
        if list_resp.status_code != 200:
            with RESULTS_LOCK:
                RESULTS["auth_issues"].append(f"User {user_id}: List requests failed {list_resp.status_code}")
            log(f"User {user_id}: List requests FAILED")
        
        # Step 3: Create a new request
        create_start = time.time()
        create_data = {
            "title": f"Test Request {user_id} - {int(time.time() * 1000)}",
            "description": f"Concurrent test user {user_id}",
            "priority": "routine",
            "items": [
                {
                    "description": f"Test item for user {user_id}",
                    "quantity": user_id,
                    "item_type": "tool"
                }
            ]
        }
        create_resp = session.post(
            f"{BASE_URL}/user-requests",
            json=create_data,
            headers=headers,
            timeout=10
        )
        create_time = time.time() - create_start
        
        with RESULTS_LOCK:
            RESULTS["timing"][f"user_{user_id}_create"] = create_time
        
        if create_resp.status_code in (200, 201):
            created = create_resp.json()
            request_id = created.get("id") or created.get("request", {}).get("id")
            user_results["requests_created"].append(request_id)
            
            with RESULTS_LOCK:
                RESULTS["successful_requests_created"] += 1
            
            log(f"User {user_id}: Create request OK - ID {request_id} ({create_time:.3f}s)")
            
            # Step 4: Update the request
            update_start = time.time()
            update_data = {
                "title": f"Updated Request {user_id}",
                "status": "in_progress"
            }
            update_resp = session.put(
                f"{BASE_URL}/user-requests/{request_id}",
                json=update_data,
                headers=headers,
                timeout=10
            )
            update_time = time.time() - update_start
            
            with RESULTS_LOCK:
                RESULTS["timing"][f"user_{user_id}_update"] = update_time
            
            if update_resp.status_code in (200, 201):
                with RESULTS_LOCK:
                    RESULTS["successful_updates"] += 1
                log(f"User {user_id}: Update request OK ({update_time:.3f}s)")
            else:
                with RESULTS_LOCK:
                    RESULTS["failed_updates"] += 1
                    RESULTS["data_collisions"].append(
                        f"User {user_id}: Update failed {update_resp.status_code} - {update_resp.text[:200]}"
                    )
                log(f"User {user_id}: Update FAILED ({update_resp.status_code}): {update_resp.text[:100]}")
        else:
            with RESULTS_LOCK:
                RESULTS["failed_requests_created"] += 1
                RESULTS["data_collisions"].append(
                    f"User {user_id}: Create failed {create_resp.status_code} - {create_resp.text[:200]}"
                )
            log(f"User {user_id}: Create FAILED ({create_resp.status_code}): {create_resp.text[:100]}")
        
        # Step 5: Logout
        logout_start = time.time()
        logout_resp = session.post(f"{BASE_URL}/auth/logout", headers=headers, timeout=10)
        logout_time = time.time() - logout_start
        
        with RESULTS_LOCK:
            RESULTS["timing"][f"user_{user_id}_logout"] = logout_time
        
        log(f"User {user_id}: Logout {'OK' if logout_resp.status_code in (200, 204) else 'FAILED'}")
        
    except requests.exceptions.Timeout:
        with RESULTS_LOCK:
            RESULTS["errors"].append(f"User {user_id}: Request timeout")
        log(f"User {user_id}: TIMEOUT")
    except Exception as e:
        with RESULTS_LOCK:
            RESULTS["errors"].append(f"User {user_id}: {str(e)}")
        log(f"User {user_id}: ERROR - {e}")
    
    user_results["total_time"] = time.time() - user_results["start_time"]
    return user_results


def run_concurrent_test(num_users=8):
    """Run concurrent user test"""
    log(f"Starting concurrent test with {num_users} users...")
    
    RESULTS["total_users"] = num_users
    start_time = time.time()
    
    # Run all users concurrently
    with ThreadPoolExecutor(max_workers=num_users) as executor:
        futures = [executor.submit(concurrent_user_test, i+1) for i in range(num_users)]
        
        user_results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                user_results.append(result)
            except Exception as e:
                log(f"Future error: {e}")
    
    total_time = time.time() - start_time
    
    # Summary
    log("\n" + "="*60)
    log("CONCURRENT TEST RESULTS")
    log("="*60)
    log(f"Total users:         {RESULTS['total_users']}")
    log(f"Successful logins:   {RESULTS['successful_logins']}")
    log(f"Failed logins:       {RESULTS['failed_logins']}")
    log(f"Requests created:    {RESULTS['successful_requests_created']}")
    log(f"Requests failed:     {RESULTS['failed_requests_created']}")
    log(f"Updates successful:  {RESULTS['successful_updates']}")
    log(f"Updates failed:      {RESULTS['failed_updates']}")
    log(f"Total time:          {total_time:.2f}s")
    
    # Issues found
    log("\n--- ISSUES DETECTED ---")
    
    if RESULTS["auth_issues"]:
        log(f"\nAuthentication Issues ({len(RESULTS['auth_issues'])}):")
        for issue in RESULTS["auth_issues"][:5]:
            log(f"  - {issue}")
    
    if RESULTS["data_collisions"]:
        log(f"\nData Collisions ({len(RESULTS['data_collisions'])}):")
        for issue in RESULTS["data_collisions"][:5]:
            log(f"  - {issue}")
    
    if RESULTS["errors"]:
        log(f"\nErrors ({len(RESULTS['errors'])}):")
        for err in RESULTS["errors"][:5]:
            log(f"  - {err}")
    
    if not any([RESULTS["auth_issues"], RESULTS["data_collisions"], RESULTS["errors"], RESULTS["failed_logins"], RESULTS["failed_requests_created"]]):
        log("\n✓ No issues detected! All concurrent operations succeeded.")
    
    # Timing stats
    if RESULTS["timing"]:
        log("\n--- TIMING STATS ---")
        timings = list(RESULTS["timing"].values())
        log(f"Avg operation time: {sum(timings)/len(timings):.3f}s")
        log(f"Min: {min(timings):.3f}s, Max: {max(timings):.3f}s")
    
    return RESULTS


if __name__ == "__main__":
    run_concurrent_test(num_users=8)