# G6 — Unified Demo / Recovery / Measured Actions

G6 packages the accepted G5 flow behind one operator entry point:

```bash
npm run demo -- <command>
```

The command does not remove human gates or pretend that Chat/Work/Codex share hidden state. It removes script-name memorization, prints the exact next action, records the commands actually used in the current run, and generates a sanitized report.

## Fresh run

After the G6 Work draft exists on the transport Issue:

```bash
git pull --ff-only
npm test
npm run demo -- prepare --issue 8 --publish-work
```

`prepare` validates/seals/publishes the Work continuation and creates a fresh local Relay fixture. Its output contains `pilot_dir`, `repo`, UI command, exact next human action, and the later `finish` command.

After the authorized local coding Agent commits the bounded fix:

```bash
npm run demo -- finish --pilot <pilot_dir> --publish-receipt
```

After Chat reviews the receipt, the human makes the explicit decision:

```bash
npm run demo -- approve --pilot <pilot_dir> --decision APPROVE
```

Finally:

```bash
npm run demo -- report --pilot <pilot_dir>
```

The generated `demo-report.json` and `demo-report.md` intentionally omit local absolute paths, store locations and credentials.

## Status and recovery

At any point:

```bash
npm run demo -- status --pilot <pilot_dir>
```

It reports current surface, owner/state, packet lineage, independent-review status, and the exact required human action.

Known failures from G5 are mapped to fail-closed recovery guidance: authenticated GitHub read 403, temporarily invisible Work comments, duplicate Work drafts, parent/task drift, stale packet ordering, public-safety blocks, missing Agent commit and environment mismatch.

Unknown failures never trigger an automatic retry.

## Metrics discipline

G4 and G5 were completed before the unified metrics recorder existed. Their exact user-action/surface-switch totals were **not** recorded prospectively, so G6 does not invent retrospective numbers. The reliable historical comparison is structural:

- G4 required a separate Chat-side continuation sealing/publishing step and separate receipt publication handling.
- G5 moved those deterministic transport operations into the local adapter and added lineage UI.
- G6 records its own actual unified CLI command count and transport edges during a fresh run.

`manual_json_copy_actions=0` in a G6 report refers only to the packaged G6 run path; it is not a claim about every earlier experiment.

After the fresh G6 run, the measured evidence will be used to decide whether a local Relay service/daemon or more provider/client adapters should be the next architecture step.
