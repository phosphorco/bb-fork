# Live materialization preimage before workspace reconciliation

The authorized in-place runtime at `/home/ubuntu/bb/fork/build/bb` had five authored tracked edits on 2026-09-26. The user approved archiving their exact diff before replacing the materialization with the reconciled locked tree.

- Runtime HEAD: `4f2ac0d322712dcf523483a63800a1ee7195699a`
- Diff receipt: `live-runtime-preimage-2026-09-26.patch`
- Diff SHA-256: `9863787c2b77890e6bc1477ec29e7918136e1a2c3094d12177460b1df58bb479`
- Selected fork result tree before runtime replacement: `cce5404a05168fc6a2e8c08aae4ce071333d8d60`

The retained diff includes older upstream documentation and startup wiring. The selected queue already contains the native request implementation and the reviewed startup ingress fix. The replacement and service activation are separate steps.
