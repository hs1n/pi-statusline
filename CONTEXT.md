# Pi Statusline Context

This context describes the observable activity that the status line reports for a Pi Coding Agent session.

## Language

**Turn**:
One model response and the tool executions it initiates, bounded by `turn_start` and `turn_end`.
_Avoid_: agent run, session

**Tool execution**:
One invocation of a Pi tool within a turn, with its own completion, error outcome, and elapsed time.
_Avoid_: tool, turn

**Turn statistics**:
The observable counts, outcomes, and elapsed times accumulated for one Turn. They describe the Turn; they do not include later Turns in the same agent run.
_Avoid_: session totals, agent totals

**Git snapshot**:
The branch, working-tree change count, and upstream movement observed for a working directory at one point in time.
_Avoid_: repository history, Git log
