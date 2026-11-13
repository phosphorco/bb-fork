# Retired realtime backlog guards

Historical source at d91825c56f, before retirement. These files are outside the selected replay queue and are not runtime or test inputs. The counter confused compression with stalled delivery; its residual 1 MiB limit also rejected valid native traffic. A real negotiated-compression test reproduces both failures. Native upstream defines no such outbound limit. Keep failed-socket isolation and native transport ownership; do not revive these thresholds without a protocol-level design and live evidence.
