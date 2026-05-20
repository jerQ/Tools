# PAT — PCAP Analysis Tool

Batch analysis of `.pcap` files using `tshark`. Run the script in a directory containing pcap files — it loads each one into a `/dev/shm` tmpfs ramdisk, runs all analyses in parallel across all available CPUs, and writes structured log files per pcap.

## Requirements

- Linux
- `tshark` (Wireshark CLI)

Install on Fedora:
```sh
sudo dnf install wireshark-cli
```

Install on Debian/Ubuntu:
```sh
sudo apt install tshark
```

## Usage

```sh
cd /path/to/pcaps
./analysis.sh
```

The script will error if `tshark` is not installed or no `.pcap` files are found in the current directory.

## Output

For each `file.pcap`, the following log files are produced:

| Log file | Contents |
|----------|----------|
| `file.pcap.protocol-hierarchy.log` | Protocol hierarchy statistics |
| `file.pcap.dns_tree.log` | DNS tree |
| `file.pcap.tcp_streams.log` | TCP streams |
| `file.pcap.udp_streams.log` | UDP streams |
| `file.pcap.uniq_ip.log` | Source and destination IP addresses |
| `file.pcap.dns_queries.log` | DNS queries with source IP and resolved addresses |
| `file.pcap.conv_ip.log` | IP conversation partners |
| `file.pcap.tcp_conv_partners.log` | TCP conversation partners with destination port |
| `file.pcap.udp_conv_partners.log` | UDP conversation partners with destination port |
| `file.pcap.http_hosts.log` | HTTP hosts |
| `file.pcap.user_agent.log` | HTTP user agents |
| `file.pcap.endpoints_ip.log` | IP endpoints |

## Example

```sh
$ ls *.pcap
capture_001.pcap  capture_002.pcap  capture_003.pcap

$ ./analysis.sh

$ ls *.log
capture_001.pcap.protocol-hierarchy.log
capture_001.pcap.dns_tree.log
capture_001.pcap.tcp_streams.log
...
```

## How it works

1. Each pcap is copied into a ramdisk (`/dev/shm`) to speed up repeated reads.
2. All 12 analysis functions run as background jobs, throttled to the number of available CPU cores.
3. The script waits for all jobs to finish before moving to the next pcap and cleaning up the ramdisk copy.
