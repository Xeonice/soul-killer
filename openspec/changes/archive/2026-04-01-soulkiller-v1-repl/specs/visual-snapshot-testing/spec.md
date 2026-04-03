# Visual Snapshot Testing

## ADDED Requirements

### Requirement: Text Snapshot Layer

The system SHALL use ink-testing-library to capture rendered text output of each ink component. Captured output MUST be stored as vitest snapshots in `__snapshots__/` directories adjacent to the test files.

#### Scenario: Capturing a component text snapshot

- WHEN a vitest snapshot test runs for an ink component
- THEN the system SHALL render the component using ink-testing-library
- AND capture the final text output (including ANSI escape sequences stripped to plain text)
- AND store the result as a vitest `.snap` file in the `__snapshots__/` directory

#### Scenario: Text snapshot mismatch

- WHEN a snapshot test runs
- AND the current rendered output differs from the stored snapshot
- THEN the test SHALL fail
- AND display a diff showing the expected vs actual text output

### Requirement: Visual Snapshot Layer

The system SHALL use Playwright to open an xterm.js test harness page with fixed dimensions (120 columns x 40 rows, monospace 14px font, background color #181818). The harness SHALL connect to soulkiller via node-pty and WebSocket, drive interactions via script, and capture screenshots at key frames.

#### Scenario: Capturing a visual snapshot of the boot screen

- WHEN a visual snapshot test runs for the boot animation
- THEN the system SHALL launch the xterm.js harness page at 120x40 with monospace 14px and #181818 background
- AND connect to the soulkiller process via node-pty + WebSocket
- AND capture a screenshot after the boot animation completes
- AND compare it against the baseline PNG in `__baselines__/`

#### Scenario: Driving interactive scenarios

- WHEN a visual snapshot test includes scripted interactions (e.g., typing a command, waiting for output)
- THEN the system SHALL send keystrokes via the WebSocket connection
- AND wait for the expected output state before capturing each screenshot

### Requirement: Pixel Comparison

The system SHALL use pixelmatch to compare current screenshots against baseline PNGs stored in `__baselines__/`. The comparison threshold MUST be set to 0.1. A test SHALL fail if the pixel difference exceeds the threshold.

#### Scenario: Screenshot matches baseline within threshold

- WHEN a visual snapshot test captures a screenshot
- AND the pixelmatch comparison against the baseline produces a diff ratio below 0.1
- THEN the test SHALL pass

#### Scenario: Screenshot exceeds diff threshold

- WHEN a visual snapshot test captures a screenshot
- AND the pixelmatch comparison produces a diff ratio at or above 0.1
- THEN the test SHALL fail
- AND generate a diff image highlighting the changed pixels
- AND save the diff image alongside the current screenshot for inspection

### Requirement: Animation Frame Testing

The system SHALL capture multiple screenshots at timed intervals for boot and exit animations. Key frames MUST be captured at defined timestamps (e.g., t=0, t=500ms, t=1500ms, t=2500ms, t=3500ms). Each keyframe SHALL have its own baseline image.

#### Scenario: Boot animation keyframe capture

- WHEN a visual snapshot test runs for the boot animation
- THEN the system SHALL capture screenshots at t=0, t=500ms, t=1500ms, t=2500ms, and t=3500ms
- AND compare each screenshot against its corresponding baseline in `__baselines__/` (e.g., `boot-t0.png`, `boot-t500.png`, etc.)

#### Scenario: Exit animation keyframe capture

- WHEN a visual snapshot test runs for the exit animation
- THEN the system SHALL trigger the exit sequence
- AND capture screenshots at the defined keyframe intervals
- AND compare each against its corresponding baseline

### Requirement: Reproducible Randomness

When the `SOULKILLER_SEED` environment variable is set, all glitch effects and random visual elements MUST use a seeded PRNG that produces identical output for the same seed. CI environments MUST always set this variable.

#### Scenario: Seeded rendering produces identical output

- WHEN `SOULKILLER_SEED` is set to a fixed value (e.g., `42`)
- AND a component with random glitch effects is rendered twice
- THEN both renders SHALL produce pixel-identical output

#### Scenario: Unseeded rendering varies between runs

- WHEN `SOULKILLER_SEED` is not set
- AND a component with random glitch effects is rendered twice
- THEN the renders MAY differ due to non-deterministic randomness

### Requirement: Baseline Management

The command `pnpm test:visual:update` SHALL regenerate all baseline images. When a test scenario has no existing baseline, the system SHALL auto-generate the baseline on first run. All baseline images MUST be committed to git.

#### Scenario: Updating all baselines

- WHEN the developer runs `pnpm test:visual:update`
- THEN the system SHALL capture fresh screenshots for every visual test scenario
- AND overwrite all existing baseline PNGs in `__baselines__/`

#### Scenario: First run with no existing baseline

- WHEN a visual snapshot test runs for a new scenario
- AND no baseline PNG exists for that scenario
- THEN the system SHALL capture the screenshot and save it as the new baseline
- AND the test SHALL pass (no comparison is possible)

#### Scenario: Baselines tracked in version control

- WHEN baseline images are generated or updated
- THEN they MUST reside in `__baselines__/` directories
- AND they MUST be committed to git so all developers and CI share the same references

### Requirement: CI Integration

GitHub Actions SHALL run tests in the following order: unit tests, then component tests, then visual snapshot tests, then integration tests. When visual snapshot tests fail, the CI pipeline MUST upload diff images as artifacts for review.

#### Scenario: CI pipeline execution order

- WHEN a GitHub Actions workflow runs
- THEN it SHALL execute test stages in order: unit → component → visual → integration
- AND a failure in an earlier stage SHALL prevent later stages from running

#### Scenario: Visual test failure artifact upload

- WHEN a visual snapshot test fails in CI
- THEN the CI pipeline SHALL upload the current screenshot, the baseline, and the diff image as GitHub Actions artifacts
- AND the artifact names SHALL clearly identify the failing test scenario

### Requirement: Fixed Rendering Environment

CI MUST use a Docker image with pinned fonts to eliminate cross-platform rendering differences. The Docker image SHALL include the exact monospace font used by the xterm.js harness to ensure pixel-identical rendering across developer machines and CI.

#### Scenario: CI uses pinned font Docker image

- WHEN visual snapshot tests run in GitHub Actions
- THEN they SHALL execute inside a Docker container with pre-installed, version-pinned monospace fonts
- AND the font configuration SHALL match the xterm.js harness settings (monospace 14px)

#### Scenario: Developer local environment mismatch

- WHEN a developer runs visual snapshot tests locally
- AND their system fonts differ from the CI Docker image
- THEN the system SHOULD display a warning that local results may differ from CI
- AND recommend running tests inside the CI Docker image for authoritative results
