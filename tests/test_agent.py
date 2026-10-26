#!/usr/bin/env python3
import unittest
from unittest.mock import patch, mock_open
import sys
import os

# Adjust import path to include agent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../agent')))

import agent

class TestAgentCPU(unittest.TestCase):

    @patch("builtins.open", new_callable=mock_open, read_data="cpu  100 20 50 200 10 5 2 1 0 0\ncpu0 50 10 25 100 5 2 1 0 0 0\nintr 123456\n")
    def test_cpu_ticks_parsing(self, mock_file):
        # Parse ticks
        active, total = agent.get_cpu_ticks()
        
        # Calculations:
        # active = user (100) + nice (20) + system (50) + irq (5) + softirq (2) + steal (1) = 178
        # idle = idle (200) + iowait (10) = 210
        # total = active (178) + idle (210) = 388
        self.assertEqual(active, 178)
        self.assertEqual(total, 388)

    @patch("agent.get_cpu_ticks")
    @patch("time.sleep")
    def test_cpu_usage_calculation(self, mock_sleep, mock_ticks):
        # Sample 1: active = 100, total = 200
        # Sample 2: active = 150, total = 300
        # active_delta = 50, total_delta = 100
        # Expected CPU% = 50%
        mock_ticks.side_effect = [
            (100, 200),
            (150, 300)
        ]

        usage = agent.get_cpu_usage()
        self.assertEqual(usage, 50.0)

class TestAgentMemory(unittest.TestCase):

    @patch("builtins.open", new_callable=mock_open, read_data="MemTotal:        16384000 kB\nMemFree:          4096000 kB\nMemAvailable:     8192000 kB\nBuffers:           512000 kB\nCached:           1024000 kB\n")
    def test_memory_parsing(self, mock_file):
        total, available = agent.get_memory_usage()
        self.assertEqual(total, 16384000 * 1024)
        self.assertEqual(available, 8192000 * 1024)

    @patch("builtins.open", side_effect=FileNotFoundError)
    def test_memory_fallback(self, mock_file):
        total, available = agent.get_memory_usage()
        self.assertGreater(total, 0)
        self.assertGreater(available, 0)

class TestAgentNetworkIO(unittest.TestCase):

    net_sample = (
        "Inter-|   Receive                                                |  Transmit\n"
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n"
        "    lo: 1000       10    0    0    0     0          0         0     1000       10    0    0    0     0       0          0\n"
        "  eth0: 5000000    500   2    0    0     0          0         0  2000000     200    1    0    0     0       0          0\n"
    )

    @patch("builtins.open", new_callable=mock_open, read_data=net_sample)
    def test_network_io_parsing(self, mock_file):
        net = agent.get_network_io()
        self.assertEqual(net["rx_bytes"], 5000000)
        self.assertEqual(net["tx_bytes"], 2000000)
        self.assertEqual(net["rx_errors"], 2)
        self.assertEqual(net["tx_errors"], 1)

class TestAgentDiskIO(unittest.TestCase):

    disk_sample = (
        "   8       0 sda 100 50 2000 120 300 100 4000 240 0 100 360\n"
        "   7       0 loop0 10 0 20 5 0 0 0 0 0 0 0\n"
    )

    @patch("builtins.open", new_callable=mock_open, read_data=disk_sample)
    def test_disk_io_parsing(self, mock_file):
        disk = agent.get_disk_io()
        # sectors read: 2000 * 512 = 1024000 bytes
        # sectors written: 4000 * 512 = 2048000 bytes
        self.assertEqual(disk["read_bytes"], 1024000)
        self.assertEqual(disk["write_bytes"], 2048000)

class TestAgentSockets(unittest.TestCase):

    tcp_sample = (
        "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n"
        "   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 12345 1 0000000000000000 100 0 0 10 0\n"
        "   1: 0100007F:1F90 0100007F:D0B4 01 00000000:00000000 00:00000000 00000000     0        0 12346 1 0000000000000000 100 0 0 10 0\n"
        "   2: 0100007F:D0B4 0100007F:1F90 06 00000000:00000000 00:00000000 00000000     0        0 12347 1 0000000000000000 100 0 0 10 0\n"
        "   3: 0100007F:D0B5 0100007F:1F90 08 00000000:00000000 00:00000000 00000000     0        0 12348 1 0000000000000000 100 0 0 10 0\n"
    )

    @patch("os.path.exists", return_value=True)
    def test_socket_connections_parsing(self, mock_exists):
        with patch("builtins.open", mock_open(read_data=self.tcp_sample)):
            sockets = agent.get_socket_connections()
            self.assertEqual(sockets["listen"], 2) # Parsed for /proc/net/tcp and /proc/net/tcp6
            self.assertEqual(sockets["established"], 2)
            self.assertEqual(sockets["time_wait"], 2)
            self.assertEqual(sockets["close_wait"], 2)

    @patch("os.path.exists", return_value=False)
    def test_socket_connections_fallback(self, mock_exists):
        sockets = agent.get_socket_connections()
        self.assertGreater(sockets["total"], 0)
        self.assertIn("established", sockets)

class TestAgentPayload(unittest.TestCase):

    @patch("agent.get_cpu_usage", return_value=25.5)
    @patch("agent.get_memory_usage", return_value=(10000000, 5000000))
    @patch("agent.get_disk_usage", return_value=(50000000, 20000000))
    @patch("agent.get_system_uptime", return_value=12345.0)
    @patch("agent.get_process_uptime", return_value={"nginx": 12000.0})
    def test_build_metrics_payload(self, m_proc, m_uptime, m_disk, m_mem, m_cpu):
        cfg = {"server_id": "test-srv-1", "processes": ["nginx"]}
        payload = agent.build_metrics_payload(cfg)
        self.assertEqual(payload["server_id"], "test-srv-1")
        m = payload["metrics"]
        self.assertEqual(m["cpu_usage_percentage"], 25.5)
        self.assertEqual(m["memory_total_bytes"], 10000000)
        self.assertEqual(m["memory_usage_percentage"], 50.0)
        self.assertEqual(m["disk_usage_percentage"], 40.0)
        self.assertEqual(m["system_uptime_seconds"], 12345.0)
        self.assertIn("network_rx_bytes", m)
        self.assertIn("disk_read_bytes", m)
        self.assertEqual(m["processes"]["nginx"], 12000.0)

if __name__ == "__main__":
    unittest.main()
