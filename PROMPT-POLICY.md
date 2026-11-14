# Phosphor BB prompt policy

BB instructions should support our team’s workflows without contradicting the
agent’s assignment. Use this document as the rationale for prompt patches,
including future changes to `bb guide` and CLI help.

## Intended behavior

- **Respect assigned authority.** User instructions or an assigned role can
  authorize delegation and messaging. Do not require repeated permission or
  imply permission that has not been granted.
- **Follow the agreed return route.** Deliver findings and requests through the
  assigned channel. Do not insist on a final response to the parent when an
  explicit message is required. Explain when parent notifications are off or
  stuck; do not promise automatic delivery.
- **Keep coordination useful.** Prefer substantive messages. Avoid acknowledgements,
  duplicate summaries and blocking. BB agents continue independent work and
  receive results through messages or configured notifications.
- **Keep guidance consistent.** Provider instructions, `bb guide`, chapters and
  command help should agree on behavior and use correct command syntax. Put
  guidance where it is useful rather than repeating the introduction everywhere.

The [current wording patch](patches/0008-prompt-wording.patch) changes the stock
introduction’s delegation and return-route advice to follow these principles.

## Match the audience

- **BB agents:** supply only guidance needed to act in a BB thread. Do not teach
  blocking commands such as `bb thread wait`; use messages and notifications.
- **Humans and other harnesses:** preserve the full CLI reference, including
  blocking commands. Codex or Claude running inside a BB thread counts as a BB
  agent; the harness name alone does not determine the audience.

Keep optional mechanics in reference material, not repeated in agent instructions.
Do not patch reference text merely because it describes capabilities an agent
should not normally use. Hide nothing by rewriting assembled output; make the
instruction/skill source appropriate for its audience. Full reference commands
remain explicitly discoverable; this is context design, not access control.

## Where changes belong

Edit authored templates before interpolation, or use a native plugin’s own
instruction contribution. Never replace text across assembled prompts, message
bodies, quoted content or provider output. Matching user text must stay untouched.

Phosphor Guide currently supplies the deployed introduction through the native
SDK; the stock BB Guide introduction is disabled. The fork patch updates that
stock template separately. Verify the enabled producer when changing
`bb.plugin.bb-guide.instructions`: a source edit alone does not prove that agents
receive it.

Runtime Prompt Rules is [retired](__archived/patch-prompt-rewriting/README.md).
Keep source wording changes in the dedicated prompt patch capability. Preserve
useful upstream guidance and retire patches when upstream meets the need.

## Checklist for a prompt change

1. **Explain the need.** Show the existing wording, the conflict it causes and the
   intended behavior. Cite the relevant section of this document.
2. **Identify the source.** Name the template, plugin contribution or CLI output
   and who receives it. Follow the existing [fork approval policy](README.md#fork-changes-are-a-last-resort).
3. **Verify the result.** Check effective guide/help output or fresh provider
   instructions, intact placeholders and unchanged message bodies. Missing
   required source matches must fail visibly. A model reply alone is not proof.
4. **Keep the patch maintainable.** Consolidate related wording changes and update
   the capability catalog, checksums and replay bindings when patch bytes change.

This policy describes instructions, not enforcement. It does not change routing,
authorization or messaging semantics. CLI guide changes remain future work.
