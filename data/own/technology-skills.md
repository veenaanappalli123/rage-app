# Networking and Cybersecurity

## Networking foundations
Networking foundations include the OSI and TCP/IP models, encapsulation, IPv4 and IPv6 addressing, subnetting, CIDR, private address ranges, MAC addresses, ARP, switches, routers, VLANs and gateways.

TCP and UDP are transport protocols. TCP uses handshakes and retransmissions to provide reliable communication. UDP has lower overhead and does not provide the same delivery guarantees.

DNS, DHCP, NAT, ICMP, routing and default routes are important network services and concepts. HTTP and HTTPS are application protocols. TLS, certificates, proxies and reverse proxies help secure and manage communication.

## Network tools and diagnostics
Common network diagnostic tools include ping, traceroute, ip, ipconfig, ss, netstat, dig, nslookup, curl, wget, nc, netcat and tcpdump.

Wireshark is used for packet capture and protocol inspection. Firewall rule review and port reachability testing help diagnose connectivity problems.

Network troubleshooting includes diagnosing DNS failures, timeouts, refused connections and TLS errors. HTTP status codes, headers and response bodies are useful when investigating web communication.

## Cybersecurity foundations
The CIA triad consists of confidentiality, integrity and availability. Threat modelling considers assets, attack surfaces, vulnerabilities, threats and risks.

Security principles include least privilege, defense in depth and secure defaults. Security policies, risk registers and security awareness support an organisation's security practices.

Legal authorization, scope, rules of engagement and lab safety are essential before conducting security testing.

## Identity, cryptography and secrets
Authentication and authorization are identity and access management concepts. Other topics include multi-factor authentication, password managers, role-based access control (RBAC), attribute-based access control (ABAC), IAM roles and least-privilege permissions.

Hashing and encryption are different concepts. Cryptographic topics include salts, key derivation, digital signatures, symmetric and asymmetric cryptography, public key infrastructure (PKI) and TLS.

Certificates, key rotation, secret storage and vaults help protect credentials and cryptographic material. Session management includes cookies, tokens and secure password storage.

## Web and application security
Application security topics include the OWASP Top 10 and secure development lifecycle.

Common vulnerabilities include SQL injection, NoSQL injection, cross-site scripting (XSS), cross-site request forgery (CSRF), server-side request forgery (SSRF) and path traversal.

Other risks include broken access control, insecure direct object references (IDOR), insecure deserialization and unsafe file uploads.

API security includes authorization, rate limiting, input validation and CORS. Secure headers, content security policy and TLS configuration help protect web applications.

Security work also includes threat modelling, security testing and remediation verification.

## Network, host and cloud security
Network and infrastructure security includes firewall design, segmentation, VPNs and secure remote access.

Host security includes Linux and Windows hardening, patching and endpoint protection. Cloud security includes IAM, security groups, storage permissions and audit logs.

## Defensive security and incident response
Defensive security includes centralized logging, SIEM concepts, alert triage, indicators of compromise, detection rules and threat intelligence.

The incident response lifecycle includes containment, eradication and recovery. Digital forensics requires careful evidence handling.

Backups, recovery testing, business continuity and disaster recovery support resilience. Risk assessment, security reporting and post-incident lessons learned help improve security.

## Authorized security testing tools
Nmap supports scoped network discovery and service enumeration. Wireshark and tcpdump support packet analysis.

Burp Suite supports authorized web application testing. OWASP ZAP, dependency scanners and static analysis tools support security assessment.

Kali Linux is a lab environment, not a substitute for networking and security fundamentals. Practice should take place in intentionally vulnerable labs and systems that you own or are authorized to test.

## Security concepts explained
Least privilege means giving a user, process or system only the permissions required to perform its assigned task, and no unnecessary permissions.

Authentication verifies who a user or system is. Authorization determines what that authenticated identity is allowed to access or do.

Network segmentation divides a network into separate sections. It helps limit unnecessary communication between sections and can contain the spread of attacks if one section is compromised.
