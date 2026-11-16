# Realtime compression threshold correction

Job: a completed BB reply should appear without reloading. The November 16 D/E trials received correct retained inference results while their visible timeline lagged seconds to minutes. Account/home routing and Flo repair are outside this change.

## Root evidence and owner

The ordinary native WebSocket negotiated permessage-deflate with context takeover. Sixty-two bounded server samples showed its sender DEFLATING with roughly 5,800 queued frames, many 87 bytes. Buffered amount equaled sender-owned bytes (about 0.97–1.05 MiB); the TCP writable queue stayed zero. Four timeline pushes, including the final completed window, were generated and accepted by the sender while the browser still held its older timeline. Send return was admission to the compression queue, not browser delivery. This establishes compression-queue delay rather than a missing timeline subscription or TCP backpressure for the correlated trial.

The ws implementation applies threshold 1024 only when server_no_context_takeover is negotiated. Existing native options therefore did not exempt tiny updates. Upstream 05199007 and fresh main da3e60b81d560e114a2bec724bb59c997aaaae7f have the same options. Plugins cannot own the host WebSocket negotiation or sender queue. Cole explicitly approved the bounded core correction.

## Small correction and tradeoff

Add `serverNoContextTakeover: true` to the existing native compression options in `0006-service-lifecycle-and-transport.patch`. Retain threshold 1024, best-speed compression, existing send options, ordering, failure isolation and all API/routing behavior. Do not introduce a custom queue, threshold eviction, payload-sizing branch or protocol version. Large frames remain compressed; they lose compression-context reuse between messages. Fresh handshakes are required; changing future options cannot drain an existing connection backlog.

## Verification before activation

The new real-socket regression fails against the original configuration on missing server_no_context_takeover. It passes with the correction and verifies exact ordered mixed JSON delivery under 20 ms CPU contention slices, native compressor bypass for small frames and compressor invocation for every large frame. Seven focused tests pass, including terminal/daemon compression refusal, failed-peer isolation, and the unchanged 12,000-message above 1 MiB/no-eviction regression. Full server typecheck passes.

A separate private loopback comparison used the live Node 22.22.0/ws 8.22.1 cohort, six clients with 480 messages each (87-byte updates and 21,904-byte snapshots), two reversed-order rounds and identical 119 CPU contention slices per trial. All 17,280 messages retained exact bytes/order and TCP queues stayed empty. Current p95 latency was 571/350 ms; native no-context negotiation 171/101 ms; explicit small-message bypass 126/122 ms. These bounded synthetic results demonstrate the mechanism, not a production latency SLO. Raw receipts stay in the private host bb-stalls-nov15 evidence folder.

This commit prepares source and exact replay only. Full runtime build, restart, fresh-handshake proof and correlated live BB reply acceptance are separate deployment work. No database or credential transition is required.

## Compile-time boundary follow-up

PR 30 CI found a real missing native option in the existing host-daemon ambient ws declaration, which integration tests include while compiling server source. Add its optional boolean field rather than cast the runtime options or introduce another type path. The full integration and server typechecks now pass, along with the seven native tests and targeted lint/formatting. The initial broad CI failures remain recorded separately; this closes the identified new type regression without claiming unrelated suites pass.
