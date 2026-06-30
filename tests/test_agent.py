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

if __name__ == "__main__":
    unittest.main()
