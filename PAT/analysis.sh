#!/bin/bash
# PCAP-ANALYSIS
# Created: jerq <jerq@jerq.fi>
# 
# Usage:
# Run this script in same directory where pcap-files are located

# Functions
# Protocol Hierarchy Statistics
phs () {
  tshark -r $1 -qz io,phs 2>/dev/null >> $2.protocol-hierarchy.log
}

# DNS Tree
dns_tree () {
  tshark -r $1 -qz dns,tree 2>/dev/null >> $2.dns_tree.log
}

# TCP Streams
tcp_streams () {
  tshark -r $1 -qz conv,tcp 2>/dev/null >> $2.tcp_streams.log
}

# UDP Streams
udp_streams () {
  tshark -r $1 -qz conv,udp 2>/dev/null >> $2.udp_streams.log
}

# Unique IP-addresses
uniq_ips () {
  tshark -r $1 -T fields -e ip.dst ip.src 2>/dev/null >> $2.uniq_ip.log
}

# DNS query names
dns_queries () {
  tshark -r $1 -e ip.src -e dns.qry.name -e dns.a -T fields dns 2>/dev/null >> $2.dns_queries.log
}

# IP conversation partners
conv_ip () {
  tshark -r $1 -qz conv,ip 2>/dev/null >> $2.conv_ip.log
}

# Conversation partners TCP
conv_partners_tcp () {
  tshark -r $1 -T fields -e ip.src -e ip.dst -e tcp.dstport 2>/dev/null >> $2.tcp_conv_partners.log
}

# Conversation partners UDP
conv_partners_udp () {
  tshark -r $1 -T fields -e ip.src -e ip.dst -e udp.dstport 2>/dev/null >> $2.udp_conv_partners.log
}

# HTTP hosts
http_hosts () {
  tshark -r $1 -T fields -e http.host 2>/dev/null >> $2.http_hosts.log
}

# User Agents
user_agents () {
  tshark -r $1 -T fields -e http.user_agent 2>/dev/null >> $2.user_agent.log
}

# Endpoints
endpoints_ip () {
  tshark -r $1 -qz endpoints,ip 2>/dev/null >> $2.endpoints_ip.log
}

# Check if processors are fully utilized
check_jobs () {
  if [[ $(jobs -r -p | wc -l) -ge $cpus ]]; then
    wait -n
  fi
}


# Main program

# Find PCAP-files from local directory
for filecap in $(ls -1 *.pcap); do
  # Create tempfile to memory
  memcap="$(mktemp -p /dev/shm)"

  # Read pcap to mem
  tshark -r $filecap -w $memcap 2>/dev/null

  # Number of CPUs
  cpus=$(grep -c ^processor /proc/cpuinfo)

  # Output file
  logfile=$(echo "${filecap##*/}")

  # Analyze each file
  phs $memcap $logfile &
  check_jobs 

  dns_tree $memcap $logfile &
  check_jobs 

  tcp_streams $memcap $logfile &
  check_jobs 

  udp_streams $memcap $logfile &
  check_jobs 

  uniq_ips $memcap $logfile &
  check_jobs 

  dns_queries $memcap $logfile &
  check_jobs 

  conv_ip $memcap $logfile &
  check_jobs 

  conv_partners_tcp $memcap $logfile &
  check_jobs 

  conv_partners_udp $memcap $logfile &
  check_jobs 

  http_hosts $memcap $logfile &
  check_jobs 

  user_agents $memcap $logfile &
  check_jobs 

  endpoints_ip $memcap $logfile &
  check_jobs 

  # Wait until all processes are finnished
  # Then move to next pcap
  wait -n

  # Clean up and remove memcap
  rm $memcap
done
