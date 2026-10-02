# Contributing

Contributions are welcome! Please follow these guidelines when contributing to this project.

This repository holds two independent projects: the Python scripts under `scripts/`
with their tests in `tests/`, and the React app under `web/` with its tests in
`web/src/**/__tests__/`. They share nothing but this repository, so you only need to
set up and run the one you are changing.

**Where to run things:** every command below runs from the **repository root** unless
its block says otherwise. The web commands are the only exception, and they run from
`web/`.

## Getting started

1. Fork the repository and clone your fork, then `cd` into the repository root.

2. Create a virtualenv and install the Python dependencies:

   ```shell
   python3 --version                              # must be 3.10 or newer
   python3 -m venv .venv
   source .venv/bin/activate                      # Windows PowerShell: .venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

   **Python 3.10 and newer** can install the dependencies. This project is *verified
   on Python 3.11 and 3.14*; on 3.10 pip resolves an older major of `pandas` than on
   3.11+, so that combination is not the one these steps were tested against. Python
   3.9 and older cannot install the dependencies at all. If `python3 --version`
   reports anything older than 3.10, install a newer interpreter first — for example
   `brew install python@3.12` on macOS, or `sudo apt install python3.12
   python3.12-venv` on Ubuntu — and re-run this step.

   A virtualenv is not optional: installing into a system interpreter is refused on
   macOS and on current Linux distributions (PEP 668,
   `externally-managed-environment`), and a bare `python3` usually has neither `arxiv`
   nor `pandas`.

   `.venv/` is not in `.gitignore` yet, so it will show up as untracked in
   `git status`. To keep the working tree clean, create it one directory above the
   repository instead — `python3 -m venv ../research-paper-feed-venv` — and activate
   that path.

3. Make your changes.

4. Run the Python tests, from the repository root:

   ```shell
   python -m unittest discover -s tests -v
   ```

## Setting up the web app

Only needed if you are changing `web/`. The web app has its own dependencies and its
own test suite; nothing under `scripts/` needs either of them.

From the repository root:

```shell
cd web
npm ci
```

The next three commands run from `web/`, so stay there — or run `cd ..` first to get
back to the repository root:

```shell
npm run typecheck
npm test
npm run build
```

All three must pass before you open a pull request. `npm test` is the only web test
command; `npm run test:watch` reruns the same tests interactively as you edit. This
project has no linter for either stack, so there is no lint step to run —
`npm run typecheck` (`tsc --noEmit`) is the web stack's only static analysis, and the
Python suite is the only Python gate.

## Pull requests

- For major changes, please open an issue first to discuss what you would like to change.
- Keep pull requests focused on a single change where possible.
- Add or update tests in `tests/` for any behavior you add or fix in `scripts/`, and in
  `web/src/lib/__tests__/` or `web/src/__tests__/` for anything you change in `web/`.
- Make sure the checks above pass before requesting review: the Python suite if you
  touched `scripts/`, plus `npm run typecheck`, `npm test` and `npm run build` if you
  touched `web/`. These are the same commands CI runs (it also generates a small paper
  index before `npm run build`).
- Make sure the CI workflow passes before requesting review.

## Reporting issues

If you encounter a bug or have a feature request, please open an issue describing:

- What you expected to happen.
- What actually happened.
- Steps to reproduce, if applicable.
