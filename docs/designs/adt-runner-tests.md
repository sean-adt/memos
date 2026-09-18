# Portable tests on the ADT Runner

The self-hosted ADT Runner and its Docker sidecar share `/home/runner/_work`, but
not `/tmp`. SQLite upgrade fixtures must use the Actions `RUNNER_TEMP` directory
when available so both processes access the same files. Local execution keeps
`t.TempDir()`. Each fixture keeps private permissions, a unique directory and test
cleanup. Missing configured directories fail explicitly.

The attachment sniffing test uses `.xyz`, which is a registered MIME extension on
some Linux distributions. Use an explicitly test-only unknown suffix so the test
exercises content sniffing consistently without changing the application behavior.

No test is removed or skipped. Migration tests continue booting real previous
Memos versions and reading/migrating the resulting database. Workflow, application
runtime, schema and authentication are unchanged.
