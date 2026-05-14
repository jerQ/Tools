# PCAP-analysis

## Requirements
* Linux
* Tshark

## Description
Script locates all pcap-files in running directory and starts processing them.
Each pcap is read to memory so it can be processed more easily and more efficiently.

Script uses all available CPU-power to run analysis and it writes all its findings
to a file, which is named after the original pcap-file.

You can easily add more analytic functions based on your needs.

Log files:

* Protocol hierarchy statistics
* DNS tree
* TCP streams
* UDP streams
* Unique IP-addresses
* DNS queries
* IP conversations
* TCP conversations
* UDP conversations
* HTTP Hosts
* User Agents
* Endpoints

## Example usage

```
user@lab:~/PCAP$ ls *.pcap
maccdc2012_00000.pcap  maccdc2012_00002.pcap maccdc2012_00004.pcap  
maccdc2012_00006.pcap  maccdc2012_00008.pcap maccdc2012_00001.pcap  
maccdc2012_00003.pcap  maccdc2012_00005.pcap maccdc2012_00007.pcap  
maccdc2012_00009.pcap

user@lab:~/PCAP$ ./analysis.sh

user@lab:~PCAP$ ls *.pcap.*log 
maccdc2012_00000.pcap.conv_ip.log maccdc2012_00000.pcap.tcp_conv_partners.log
maccdc2012_00000.pcap.dns_queries.log maccdc2012_00000.pcap.tcp_streams.log
maccdc2012_00000.pcap.dns_tree.log maccdc2012_00000.pcap.udp_conv_partners.log
maccdc2012_00000.pcap.http_hosts.log maccdc2012_00000.pcap.udp_streams.log
maccdc2012_00000.pcap.protocol-hierarchy.log maccdc2012_00000.pcap.uniq_ip.log
```



