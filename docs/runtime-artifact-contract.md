# Runtime artifact contract

The immutable deployment receipt must bind both public launch wrappers and the
runtime entries they spawn. On Linux, `bb-app.js` launches
`server/dist/index.js`; `bb-host-daemon.js` launches
`host-daemon/dist/daemon-bundle.mjs`. Live process proofs therefore compare
those runtime command-line paths with files inside the same sealed artifact.
