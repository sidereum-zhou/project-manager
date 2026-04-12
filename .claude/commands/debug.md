Debug this issue: $ARGUMENTS

Approach:

1. Reconstruct the likely execution path before editing.
2. Identify whether the problem is in:
   - Electron main process
   - preload / IPC bridge
   - renderer state
   - view logic
   - data normalization or persistence
3. Fix the root cause, not only the symptom.
4. Add a regression test if the bug is in parsing, store migration, detectors, or process logic.
5. Run the narrowest verification that proves the fix.
6. Report:
   - root cause
   - fix
   - verification
   - any follow-up risk
