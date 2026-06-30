#!/usr/bin/env python3
# ==============================================================================
# CLOUDMON AGENT - MULTI-CLOUD LIGHTWEIGHT MONITORING
# ==============================================================================
# Requirements: Pure Python 3, standard library ONLY.
# Safe for non-root execution. Parses /proc filesystem directly.
# ==============================================================================

import os
import sys
import time
import json
import ssl
import urllib.request
import urllib.error

CONFIG_PATH = "/etc/cloudmon-agent.conf"

def log_error(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [ERROR] {msg}", file=sys.stderr)

def log_info(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [INFO] {msg}")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        log_error(f"Configuration file not found at {CONFIG_PATH}")
        sys.exit(1)
    
    # Ensure configuration file is secure (permissions 600)
    try:
        mode = os.stat(CONFIG_PATH).st_mode
        # In non-Windows systems, check for strict permissions (600: read/write owner only)
        if os.name != 'nt':
            if (mode & 0o077) != 0:
                log_error(f"Unsafe configuration file permissions! {CONFIG_PATH} must be owned by the agent user and set to chmod 600.")
                sys.exit(1)
    except Exception as e:
        log_error(f"Failed to check config file permissions: {e}")
        sys.exit(1)

    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        log_error(f"Failed to parse config file: {e}")
        sys.exit(1)

def get_cpu_ticks():
    """Reads /proc/stat and returns (active_ticks, total_ticks)"""
    try:
        with open("/proc/stat", "r") as f:
            for line in f:
                if line.startswith("cpu "):
                    parts = list(map(int, line.strip().split()[1:9]))
                    # Parts correspond to: user, nice, system, idle, iowait, irq, softirq, steal
                    user, nice, sys_t, idle, iowait, irq, softirq, steal = parts
                    active = user + nice + sys_t + irq + softirq + steal
                    total = active + idle + iowait
                    return active, total
    except Exception as e:
        log_error(f"Failed to read /proc/stat: {e}")
    return 0, 0

def get_cpu_usage():
    """Takes two samples over 1 second to calculate CPU percentage delta."""
    a1, t1 = get_cpu_ticks()
    time.sleep(1.0)
    a2, t2 = get_cpu_ticks()
    
    active_delta = a2 - a1
    total_delta = t2 - t1
    
    if total_delta <= 0:
        return 0.0
    return (active_delta / total_delta) * 100.0

def get_memory_usage():
    """Parses /proc/meminfo for MemTotal and MemAvailable (or free+buffers+cached fallback)"""
    mem_total = 0
    mem_available = None
    mem_free = 0
    buffers = 0
    cached = 0
    
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split()
                if not parts:
                    continue
                key = parts[0].strip(":")
                val = int(parts[1]) * 1024 # /proc/meminfo values are in kB
                
                if key == "MemTotal":
                    mem_total = val
                elif key == "MemAvailable":
                    mem_available = val
                elif key == "MemFree":
                    mem_free = val
                elif key == "Buffers":
                    buffers = val
                elif key == "Cached":
                    cached = val
    except Exception as e:
        log_error(f"Failed to read /proc/meminfo: {e}")

    if mem_total == 0:
        return 0, 0

    if mem_available is None:
        # Fallback for older kernels
        mem_available = mem_free + buffers + cached
        
    return mem_total, mem_available

def get_disk_usage():
    """Uses os.statvfs to determine disk size and utilization on root '/'"""
    try:
        stat = os.statvfs("/")
        total = stat.f_blocks * stat.f_frsize
        free = stat.f_bfree * stat.f_frsize
        used = total - free
        return total, used
    except Exception as e:
        log_error(f"Failed to get disk usage: {e}")
    return 0, 0

def get_system_uptime():
    """Reads system uptime from /proc/uptime"""
    try:
        with open("/proc/uptime", "r") as f:
            return float(f.readline().split()[0])
    except Exception as e:
        log_error(f"Failed to read /proc/uptime: {e}")
    return 0.0

def get_process_uptime(process_names):
    """Scans /proc/[pid]/comm to find matching processes and calculates their uptime"""
    uptimes = {name: 0.0 for name in process_names}
    if not process_names:
        return uptimes

    try:
        clk_tck = os.sysconf("SC_CLK_TCK")
    except Exception:
        clk_tck = 100 # Standard fallback

    sys_uptime = get_system_uptime()
    if sys_uptime == 0.0:
        return uptimes

    # Find matching processes in /proc
    pids = [d for d in os.listdir("/proc") if d.isdigit()]
    
    for pid in pids:
        try:
            # Read process command name
            with open(f"/proc/{pid}/comm", "r") as f:
                comm = f.read().strip()
            
            if comm in process_names:
                # Read process stat file to get start time (field 22)
                with open(f"/proc/{pid}/stat", "r") as f:
                    stat_line = f.read().strip()
                
                # Fields are separated by space, but process names with spaces
                # are wrapped in parenthesis, e.g. (my process name).
                # Find the closing parenthesis to safely split the rest.
                rpar = stat_line.rfind(")")
                if rpar != -1:
                    fields = stat_line[rpar+2:].split()
                    # field 22 is start_time. Index in fields is:
                    # 22 (1-based) - 2 (since we sliced off pid and comm) = index 19.
                    start_ticks = int(fields[19])
                    start_seconds = start_ticks / clk_tck
                    proc_uptime = sys_uptime - start_seconds
                    
                    # Take the longest running instance if multiple PIDs exist
                    if proc_uptime > uptimes[comm]:
                        uptimes[comm] = proc_uptime
        except Exception:
            # PIDs can disappear or be inaccessible (permissions); ignore
            continue

    return uptimes

def build_metrics_payload(config):
    processes = config.get("processes", [])
    
    cpu_usage = get_cpu_usage()
    mem_total, mem_available = get_memory_usage()
    disk_total, disk_used = get_disk_usage()
    sys_uptime = get_system_uptime()
    process_uptimes = get_process_uptime(processes)
    
    mem_used = mem_total - mem_available
    mem_usage_pct = (mem_used / mem_total * 100.0) if mem_total > 0 else 0.0
    disk_usage_pct = (disk_used / disk_total * 100.0) if disk_total > 0 else 0.0
    
    payload = {
        "server_id": config.get("server_id"),
        "metrics": {
            "cpu_usage_percentage": round(cpu_usage, 2),
            "memory_total_bytes": mem_total,
            "memory_used_bytes": mem_used,
            "memory_usage_percentage": round(mem_usage_pct, 2),
            "disk_total_bytes": disk_total,
            "disk_used_bytes": disk_used,
            "disk_usage_percentage": round(disk_usage_pct, 2),
            "system_uptime_seconds": round(sys_uptime, 2),
            "processes": {k: round(v, 2) for k, v in process_uptimes.items()}
        }
    }
    return payload

def send_report(url, token, payload, ca_bundle=None):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    # Configure TLS context
    ssl_context = ssl.create_default_context()
    if ca_bundle:
        try:
            ssl_context.load_verify_locations(cafile=ca_bundle)
            log_info(f"Loaded CA bundle from {ca_bundle} for verification.")
        except Exception as e:
            log_error(f"Failed to load configured CA bundle: {e}")
            sys.exit(1)

    try:
        with urllib.request.urlopen(req, context=ssl_context) as response:
            status = response.status
            body = response.read().decode("utf-8")
            return status, body
    except urllib.error.HTTPError as e:
        log_error(f"HTTP Server returned error {e.code}: {e.read().decode('utf-8', errors='ignore')}")
        return e.code, None
    except urllib.error.URLError as e:
        log_error(f"Network / connection failed: {e.reason}")
        return None, None
    except Exception as e:
        log_error(f"Unexpected error sending report: {e}")
        return None, None

def main():
    log_info("Starting CloudMon Agent...")
    config = load_config()
    
    api_url = config.get("api_url", "")
    token = config.get("token", "")
    server_id = config.get("server_id", "")
    check_interval = config.get("check_interval", 30)
    ca_bundle = config.get("ca_bundle")
    
    if not api_url or not token or not server_id:
        log_error("Missing required config fields (api_url, token, server_id)")
        sys.exit(1)
        
    # Enforce TLS-only connection security
    if not api_url.startswith("https://"):
        log_error(f"Insecure API URL '{api_url}'. CloudMon Agent requires HTTPS endpoints to protect token credentials. Failing startup.")
        sys.exit(1)

    retry_delay = 5
    max_retry_delay = 300 # 5 minutes

    while True:
        log_info("Collecting metrics...")
        payload = build_metrics_payload(config)
        
        status, response_body = send_report(api_url, token, payload, ca_bundle)
        
        if status == 200 or status == 201:
            log_info("Metrics report submitted successfully.")
            retry_delay = 5 # Reset backoff
            time.sleep(check_interval)
        else:
            # Network failure or API rate-limit/errors
            log_error(f"Report submission failed. Retrying in {retry_delay}s...")
            time.sleep(retry_delay)
            # Exponential backoff
            retry_delay = min(retry_delay * 2, max_retry_delay)

if __name__ == "__main__":
    main()
