#!/usr/bin/env python3
"""
Script to update the mynetworks parameter in /etc/postfix/main.cf
by appending the network address of the non-loopback interface.
"""

import ipaddress
import re
import socket
import struct
import fcntl
import os
import sys

POSTFIX_CONF = "/etc/postfix/main.cf"
BASE_NETWORKS = "127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"


def get_non_loopback_interface_name():
    """Return the name of the single non-loopback interface."""
    interfaces = []
    with open("/proc/net/dev", "r") as f:
        for line in f:
            line = line.strip()
            if ":" in line:
                iface = line.split(":")[0].strip()
                interfaces.append(iface)

    non_loopback = [i for i in interfaces if i != "lo"]
    if not non_loopback:
        raise RuntimeError("No non-loopback interfaces found.")
    if len(non_loopback) > 1:
        print(f"[WARNING] Multiple non-loopback interfaces found: {non_loopback}. Using: {non_loopback[0]}")
    return non_loopback[0]


def get_ip_address(iface):
    """Get the IPv4 address of the given interface using ioctl."""
    SIOCGIFADDR = 0x8915
    ifreq = struct.pack("16sH14s", iface.encode(), socket.AF_INET, b"\x00" * 14)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            result = fcntl.ioctl(s.fileno(), SIOCGIFADDR, ifreq)
        except OSError as e:
            raise RuntimeError(f"Could not get IP for interface '{iface}': {e}")
    ip_bytes = result[20:24]
    return socket.inet_ntoa(ip_bytes)

def get_subnet_mask(iface):
    """Get the subnet mask of the given interface using ioctl."""
    SIOCGIFNETMASK = 0x891b
    ifreq = struct.pack("16sH14s", iface.encode(), socket.AF_INET, b"\x00" * 14)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            result = fcntl.ioctl(s.fileno(), SIOCGIFNETMASK, ifreq)
        except OSError as e:
            raise RuntimeError(f"Could not get netmask for interface '{iface}': {e}")
    mask_bytes = result[20:24]
    return socket.inet_ntoa(mask_bytes)

def derive_network_cidr(ip_str, mask_str):
    """
    Given an IPv4 address and subnet mask, return the network address
    in CIDR notation with all host bits zeroed (e.g. '172.30.1.0/24').
    """
    interface = ipaddress.IPv4Interface(f"{ip_str}/{mask_str}")
    return str(interface.network)  # e.g. '172.30.1.0/24'

def update_postfix_conf(conf_path, network_cidr):
    """
    Find the mynetworks line in main.cf (including any continuation lines),
    reset it to BASE_NETWORKS + network_cidr, and write the file back.
    """
    if not os.path.isfile(conf_path):
        raise FileNotFoundError(f"Postfix config not found: {conf_path}")

    with open(conf_path, "r") as f:
        lines = f.readlines()

    new_lines = []
    updated = False
    i = 0

    while i < len(lines):
        line = lines[i]

        if re.match(r"^\s*mynetworks\s*=", line):
            # Consume any continuation lines (lines ending with \)
            combined = line.rstrip("\n")
            while combined.rstrip().endswith("\\"):
                i += 1
                if i < len(lines):
                    combined = combined.rstrip()[:-1] + lines[i].rstrip("\n")
                else:
                    break

            # Write the clean, canonical replacement line
            new_line = f"mynetworks = {BASE_NETWORKS} {network_cidr}\n"
            new_lines.append(new_line)
            updated = True
            print(f"[INFO] Replaced mynetworks with:\n         {new_line.strip()}")
        else:
            new_lines.append(line)

        i += 1

    if not updated:
        raise ValueError("'mynetworks' directive not found in the config file.")

    with open(conf_path, "w") as f:
        f.writelines(new_lines)

    print(f"[INFO] Config written to {conf_path}")

def main():
    print("=" * 60)
    print("  Postfix mynetworks Updater")
    print("=" * 60)

    # 1. Identify non-loopback interface
    iface = get_non_loopback_interface_name()
    print(f"[INFO] Interface selected : {iface}")

    # 2. Get its IPv4 address
    ip_str = get_ip_address(iface)
    print(f"[INFO] IPv4 address       : {ip_str}")

    # 3. Get its subnet mask
    mask_str = get_subnet_mask(iface)
    print(f"[INFO] Subnet mask        : {mask_str}")

    # 4. Derive network address (all host bits = 0) in CIDR notation
    network_cidr = derive_network_cidr(ip_str, mask_str)
    print(f"[INFO] Network CIDR       : {network_cidr}")

    # 5. Patch main.cf
    update_postfix_conf(POSTFIX_CONF, network_cidr)

    print("=" * 60)
    print("  Done! Restart postfix to apply changes:")
    print("    sudo systemctl restart postfix")
    print("=" * 60)

if __name__ == "__main__":
    if os.geteuid() != 0:
        print("[ERROR] This script must be run as root (sudo).")
        sys.exit(1)
    main()