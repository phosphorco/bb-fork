# Phosphor BB prompt policy

This document records why Phosphor changes BB-authored instructions. Cite its
section anchors in prompt patch descriptions and reviews. It is a statement of
intent and review criteria, not a second prompt injected into every conversation
or blanket approval for future core changes.

## Purpose

BB's instructions should help agents use our shared team deployment correctly:
act within the authority they have been given, communicate useful results through
the agreed route, and use the actual CLI contracts. Stock advice can be accurate
for BB's default workflow yet conflict with a role or workflow we deliberately
assign. Change that advice at its authored source, with a small, reviewable delta.

The objective is coherent behavior, not a different personality or more words.
Preserve useful upstream instructions and adopt upstream improvements first.

## Authority follows the assignment

The original introduction permits spawning and messaging only after an explicit
user request, with an exception for replying. Our roles can already authorize
those actions. The wording should recognize authority granted by user
instructions or the assigned role rather than requiring the user to repeat that
authority for every action.

This does not authorize unsolicited delegation or messaging. A narrower session
instruction still controls. Prompt wording must describe authority, not expand it.

Current implementation: [prompt wording patch](patches/0008-prompt-wording.patch),
`plugins/bb-guide/introduction.ts`.

## Useful communication and explicit return routes

Prefer messages carrying decisions, findings, results or a concrete request.
Avoid acknowledgements, thanks, repeated timeline content and waiting for a reply
when no reply was requested. Waiting is appropriate for a real dependency when
the session permits it; it should not be the default coordination mechanism.

Do not make “always answer the parent in your final response” override an
explicitly assigned return route. Follow the agreed route, including an explicit
`bb thread tell` when required. If parent notifications are `stuck` or `off`, do
not imply that finishing a turn will deliver the result automatically.

Preserve correct command syntax and message-file examples. A change in wording
must not invent delivery guarantees or change messaging semantics.

## Change authored templates, not interpolated content

Prompt changes belong in BB-owned template text or a native plugin's own
instruction contribution, before user or agent content is interpolated. Never
run general find-and-replace over the assembled prompt, message bodies, quoted
material or provider output. A user's text matching an instruction fragment must
remain unchanged.

The old runtime Prompt Rules interceptor is retired. Its source and rationale
remain in [the historical archive](__archived/patch-prompt-rewriting/README.md).
Do not restore it as a convenience for applying wording changes.

## Ownership and CLI guide consistency

Use the native plugin SDK for independently contributed instructions. Phosphor
Guide currently supplies our introduction through that route; the native BB
Guide introduction is disabled in the deployed selection. The focused fork
patch also updates the stock template. These are distinct producers: changing
the stock template alone does not prove the enabled plugin's output changed.

`bb.plugin.bb-guide.instructions` is an important instruction surface. Record
which producer actually supplies it and verify the effective instruction, not
only a saved rule or source diff. Phosphor must retain the ability to customize
the guide through its supported plugin contribution or an approved source patch.

CLI `bb guide` text, chapter output, command help and provider instructions can
reach an agent at different times. Future changes to those surfaces should cite
this document and identify the exact producer and audience. Keep overlapping
advice consistent without copying the whole introduction into every chapter.
Where text is genuinely shared, prefer its existing common source. Do not build
a universal prompt registry or runtime replacement layer just for consistency.

Changing the presentation of `bb guide` is a future extension of this policy,
not a claim that its chapters/help have already been rewritten. First inspect
the actual output and identify a concrete contradiction or missing instruction.

## Patch and verification requirements

For each change, record:

- The stock behavior or wording, the concrete conflict it creates, and the
  intended agent behavior. Cite the relevant policy section.
- The exact template, CLI output or plugin contribution being changed, its
  consumers, and whether the deployed configuration enables that producer.
- The smallest source change; native/plugin alternatives and any required core
  approval follow the existing [fork policy](README.md#fork-changes-are-a-last-resort).
- Focused checks for intended wording, intact placeholders/command syntax, and
  unchanged interpolated message bodies. If matching a source fragment during
  patching, a missing required fragment must fail visibly, not silently skip.
- Effective output checks: the relevant `bb guide` chapter/help or fresh provider
  instructions as appropriate. A successful model reply alone does not prove
  which instructions were delivered.

Keep approved source wording changes in the dedicated prompt patch capability;
update its catalog, checksums and exact replay bindings when its bytes change.
Consolidate related edits rather than adding one permanent patch per sentence.
When upgrading upstream, reevaluate the motivation and retire a delta when the
native wording now meets it. Preserve archived rationale without importing it.

## Boundaries

This policy changes explanatory instructions, not routing, authorization,
message admission, parent notification implementation or inference protocols.
Do not describe an instruction as an enforced safety guarantee. Any necessary
behavioral implementation needs its own justification and verification.
