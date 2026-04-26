Prepare the current task for handoff or completion.

Workflow:

1. Review the current diff and remove any accidental changes.
2. Make sure the implementation is internally consistent across types, IPC, preload, API, and UI if applicable.
3. Run an appropriate verification command. Prefer `npm run check:quick`; use `npm run check` for broad changes.
4. Produce a short handoff summary:
   - outcome
   - key files
   - verification
   - remaining risks

Do not commit unless explicitly asked.
