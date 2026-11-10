# English Buddy

A browser platform where Franco (and later 5–20 friends) practises spoken
English with illustrated 3D characters (VRoid / VRM) that talk in real time,
recast mistakes, debrief in French, and track progress.

**To resume: read [docs/STATE.md](docs/STATE.md)**, then
[docs/BRIEF.md](docs/BRIEF.md) (the full brief and the phases). Decisions are
in [docs/DECISIONS.md](docs/DECISIONS.md).

## Rules for every session

- Talk to Franco in French. Code, comments and technical docs in English;
  `docs/STATE.md` and `docs/tests/*.md` in French.
- Do only the current phase from `docs/STATE.md`. Anything else goes to
  "Points ouverts" in `STATE.md`. Stop at the end of the phase and wait for
  Franco's go.
- This repository is **public**: never commit an API key, token or secret.
  User keys live only in the browser (`localStorage`).
- Never store voice recordings. Only text.
- Check current model names and API shapes in official docs before coding;
  log choices in `docs/DECISIONS.md`.
- Every third-party asset goes in `docs/ASSETS.md` with source and licence.
  Prefer CC0.
- Tests green before every push: `npm test` and the Playwright smoke test
  (run Playwright with `--trace off`).
- End of each phase: deployed preview, French test guide
  `docs/tests/phase-N.md`, short self-critique (what works, what is weak,
  what was measured vs assumed), one line in the log of `docs/STATE.md`.
- Say what is measured and what is assumed. Recommend; one question at a
  time.
- When Franco validates a phase (explicit go), open the next build session
  yourself, without asking again: recommended model from the phase table in
  `docs/BRIEF.md`, branch `phase-N`, and a precise starting prompt (what was
  measured, what is still unverified, what to do first, where to stop). Then
  tell Franco the session is open. Never start the next phase before his go.

## Autopilot mode (Franco away, decided 2026-11-10)

Franco asked that sessions chain on their own until the final product while
he is away. Until he says he is back, these rules **replace** "stop at the end
of the phase and wait for Franco's go":

- An **orchestrator session** (`session_01Cw13LeV4Nk6LbcMcDAQraA`, the
  phase-1 session) opens each phase session. At the end of your phase, do not
  open the next session yourself: send the orchestrator a message with
  `send_message` that starts with `PHASE <N> DONE` (or `PHASE <N> BLOCKED`)
  and gives the branch, the preview link, and what is measured vs assumed.
  A phase may need several sessions: then send `PHASE <N> CONTINUE` with the
  exact next step.
- Branch `phase-N` starts from the previous phase branch (nothing is merged
  to `main` while Franco is away). Never create a pull request, never merge,
  never invite anyone.
- Still required at the end of each phase: deployed preview, French test
  guide, self-critique, a line in the `STATE.md` log. Franco tests all the
  guides in a row when he is back.
- Anything only Franco can do (create an account, give a key, test with a
  real voice, invite friends) goes to the "À faire au retour" list in
  `STATE.md`; build a fallback so the phase still works without it.
- **Interface harmony**: follow `docs/DESIGN.md` (shared tokens, components,
  tone). Every phase takes screenshots of each screen it touches and checks
  them against it.
- **Assets**: free licences only (CC0 first; CC-BY with credit; a VRoid Hub
  model only if its conditions allow redistribution and modification in a
  public repo). Log each one in `docs/ASSETS.md`. Never commit Mixamo files.
- If usage limits stop you, commit, push, and report `PHASE <N> CONTINUE`.
