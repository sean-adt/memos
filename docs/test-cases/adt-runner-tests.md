# ADT Runner regression checks

- Attachment MIME sniffing returns image/png for an unknown test-specific suffix.
- Container data directories use RUNNER_TEMP when set, remain unique/private,
  and are removed after the test completes.
- Local execution without RUNNER_TEMP retains the normal temporary directory.
- All previous-version SQLite upgrade tests pass with the shared Actions directory.
- Full admitted ADT validation and the publish workflow remain required before
  deploying the repaired commit.
