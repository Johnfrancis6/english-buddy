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
