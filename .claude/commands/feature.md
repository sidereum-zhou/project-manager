Implement the feature described in: $ARGUMENTS

Workflow:

1. Inspect the relevant files and identify the smallest viable change set.
2. If the work is not trivial, outline a short implementation plan before editing.
3. Update types, IPC contracts, preload bridge, renderer API, and UI together when behavior crosses layers.
4. Keep the change cohesive. Avoid unrelated refactors.
5. Run the smallest relevant verification command:
   - `npm run test:store`
   - `npm run test:detectors`
   - `npm run check:quick`
   - `npm run check`
6. Summarize:
   - what changed
   - which files matter most
   - what was verified
   - any residual risk
