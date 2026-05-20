# Tools

A collection of utility tools.

## CompliancyManager

Browser-based tool for reviewing and tracking software requirements against compliance standards. Import a CSV of requirements, assess compliance status, add remarks, and export results — no server or build step required.

See [CompliancyManager/README.md](CompliancyManager/README.md).

## PAT — PCAP Analysis Tool

Bash script for batch analysis of `.pcap` files using `tshark`. Processes all pcaps in the current directory in parallel and writes analysis logs per file covering DNS, TCP/UDP streams, IP conversations, HTTP hosts, user agents, and more.

Requires: Linux, `tshark`

See [PAT/README.md](PAT/README.md).
