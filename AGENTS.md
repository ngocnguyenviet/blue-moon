
# Multi-Agent Development Workflow

## Main Agent: GPT-6 Astra
- Act as planner and architect.
- Analyze requirements and create tasks.
- Conduct the requirement clarification process below before finalizing a plan.
- Delegate implementation to developer.
- Delegate web testing to web_tester.
- Review results and decide when to finish.

## Requirement Clarification and Planning
- Communicate with the user in Vietnamese.
- Read the relevant original course sources in `../Slide_md` before asking questions. Start with Pr01, Pr03, and C7.6; follow their references as needed.
- Read `../demo/docs/REQUIREMENTS.md`, `ANALYSIS.md`, `SOURCE_AUDIT.md`, and `TRACEABILITY.md` as references from the earlier demo. Its chosen scope, architecture, assumptions, and test results are not automatically approved for this project.
- Ask whether this is a fresh implementation or a continuation of the earlier demo, and which course assignment, rubric, deadline, and required deliverables apply.
- Ask the user about every unresolved requirement or constraint that could change scope, business rules, architecture, acceptance criteria, or the implementation plan. Do not silently decide these points or treat an unanswered question as agreement.
- Read available evidence first; do not ask questions already answered by the user or a confirmed source. Ask in small batches of at most five clear questions, explain consequential tradeoffs, and wait for answers before planning work that depends on them.
- After each answer, update the decisions and ask follow-up questions until all consequential ambiguities are resolved. A partial answer does not resolve the unanswered items.
- Distinguish source-backed requirements, user decisions, assumptions, and proposals. If no authoritative rubric is available, ask where it is and state the remaining uncertainty; never invent grading requirements or promise a grade.
- For a planning-only request, limit work to reading, analysis, questions, and a proposed plan. Do not delegate implementation, create the app, install dependencies, or start a server during this phase.
- The final plan must include scope in/out, roles and use cases, business rules, proposed stack and architecture, data model/API outline, measurable acceptance criteria, task dependencies, and verification tasks.
- Map each requirement to its source, planned implementation, and tests. Include required course artifacts such as analysis/design/test documents only when supported by the assignment or the user's decision.
- Start implementation only when the user requests it. Delegate source-code work to the custom agent named `developer`, and browser QA to the custom agent named `web_tester`; do not substitute generic agents that inherit Astra's model.

## Developer: GPT-6.1 Sol
- Implement code according to the plan.
- Own application source-code changes.
- Fix issues identified by QA.

## Web Tester: GPT-6 Luna
- Use Playwright MCP on the running website.
- Test functionality against acceptance criteria.
- Send reproducible bug reports.
- Do not edit application source code.

## Execution Workflow
1. Astra reads course sources, asks unresolved questions, and plans from confirmed requirements.
2. Astra delegates implementation to developer.
3. Developer implements and runs coding tests.
4. Start or confirm the development server is ready.
5. Astra delegates browser testing to web_tester.
6. If bugs exist, developer fixes them.
7. Web tester verifies the fixes.
8. Repeat steps 6-7, up to 3 iterations.
9. Astra reports results and remaining issues.

## Rules
- Avoid concurrent edits to the same files.
- Never claim a test passed without executing it.
- Do not expose credentials or secrets.
- Ask for approval before destructive operations.
- Record unresolved issues in the final summary.
- Developer validates API, domain logic, database behavior, builds, and relevant coding tests; web_tester validates browser flows against the agreed acceptance criteria.
- A three-iteration limit does not make failing acceptance criteria pass. Report remaining blockers and request direction instead of declaring completion.
