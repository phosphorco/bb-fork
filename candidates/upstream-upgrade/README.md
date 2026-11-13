# Prompt wording for the upstream upgrade

Cole approved direct source wording changes on November 13, replacing the
general Prompt Rules runtime and patches 0046/0047. This directory contains an
**unselected candidate**, not the active patch series or a deployed change.

`prompt-wording.patch` is one coherent, wording-only patch against upstream
`05199007ecad513b714b244e46b0ab2a9a06279f`. It changes the bundled BB guide's
authored introduction: authorized delegation/message passing, and explicit
parent result delivery where the agreed return route requires it. It preserves
all unrelated introduction text, selected skills and native messaging behavior.
It does not rewrite rendered messages, interpolate text, add hooks, or alter
CLI guide chapter sources. The retired rules targeted this introduction only.

Qualification:

```
python3 candidates/upstream-upgrade/check-prompt-wording.py build/upstream-qualification
```

This requires the exact expected source fragments and a clean native patch
application. It also proves that missing required wording fails the same check
in a disposable fixture. Upstream source drift must be reviewed, not bypassed
with a fuzzy or optional replacement.

During queue regeneration, select this patch and update the fork capability
catalog together; remove 0046/0047's general rewriting interfaces and dependent
adapters. Keep their historical records in Git and the archived plugin source
under the organization repository's tracked `__archive/`. Do not remove those
patches from the old locked series piecemeal: later patches still depend on that
source and the old result tree must remain reproducible until replaced.

Activation must enable the patched native BB guide introduction and disable
Phosphor Guide's duplicate contribution in the same reviewed cutover. Keep
bundled guide skills enabled. Verify a fresh provider construction has one
introduction with the expected wording and unchanged user text. No setting,
runtime state, source lock or service has been changed by this candidate.
