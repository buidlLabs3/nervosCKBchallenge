# Screenshot Provenance

All screenshots were captured from this Campaign 03 execution. No transaction
identifier was copied from the upstream tutorial.

| Image                              | Source                                                                   | Claim                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `01-offckb-environment.png`        | `01-environment.log`, rendered by `render-proof-screenshots.mjs`         | Tool versions, active RPC, committed deployment                        |
| `02-contract-build-and-tests.png`  | Build and VM logs, rendered by `render-proof-screenshots.mjs`            | Bytecode build and exit codes 0, 10, 11, 12                            |
| `03-deployment-and-rpc.png`        | Deployment and verifier logs, rendered by `render-proof-screenshots.mjs` | Local deployment and 47 verified invariants                            |
| `04-funded-workbench.png`          | Playwright against the production frontend                               | 300 CKB visible under the derived lock                                 |
| `05-wrong-witness-rejected.png`    | Playwright after submitting the mismatched witness                       | Exit code 11 and unchanged 300 CKB balance                             |
| `06-correct-witness-committed.png` | Playwright after waiting for RPC commitment                              | Committed unlock and 200.99999 CKB change                              |
| `07-mobile-committed.png`          | Same committed browser state at 390 x 844                                | Responsive final state without horizontal overflow                     |
| `08-capacity-aware-retry.png`      | Playwright against the remaining 200.99999 CKB lock                      | 92.99998 CKB maximum preserves 108 CKB change and reaches exit code 11 |

The first three images are reproducibly generated from checked-in raw terminal
records:

```bash
cd campaign-03/simple-lock-lab
pnpm proof:screenshots
```

The browser captures used the production Next.js server at
`http://127.0.0.1:3000`. Desktop and mobile checks returned HTTP 200, zero page
or console errors, and no horizontal overflow.
