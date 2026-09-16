# kubri-action

Runs [kubri](https://kubri.dev) in GitHub Actions to sign and publish your software for common
package managers and software update frameworks.

## Usage

```yaml
name: publish

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: kubri/kubri-action@v1
        env:
          GITHUB_TOKEN: ${{ github.token }}
          KUBRI_PGP_KEY: ${{ secrets.KUBRI_PGP_KEY }}
          KUBRI_RSA_KEY: ${{ secrets.KUBRI_RSA_KEY }}
          KUBRI_ED25519_KEY: ${{ secrets.KUBRI_ED25519_KEY }}
```

Kubri reads its configuration from `.kubri.yml` in the working directory or from
`.github/kubri.yml`. See the [configuration reference](https://kubri.dev/docs/configuration).

## Inputs

| Input          | Default  | Description                                                            |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `version`      | `latest` | Version or semver range of kubri to install, such as `0.8.0` or `^0.8` |
| `args`         | `build`  | Arguments to run kubri with                                            |
| `workdir`      | `.`      | Directory to run kubri in                                              |
| `install-only` | `false`  | Only install kubri and add it to `PATH`                                |

## Outputs

| Output    | Description                 |
| --------- | --------------------------- |
| `version` | The installed kubri version |

## Environment

Kubri takes credentials from the environment, so pass them with `env` on the step.

| Variable                                                               | Used for                                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                                                         | The `github` source and target. The workflow token covers the current repository; a target in another repository needs a personal access token or GitHub App token. |
| `GITLAB_TOKEN`                                                         | The `gitlab` source                                                                                                                                                 |
| `KUBRI_PGP_KEY`, `KUBRI_RSA_KEY`, `KUBRI_ED25519_KEY`, `KUBRI_DSA_KEY` | Signing keys. Append `_PATH` to the name to reference a file instead.                                                                                               |

Cloud targets use each provider's default credential chain, so
[aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials),
[google-github-actions/auth](https://github.com/google-github-actions/auth) and
[azure/login](https://github.com/azure/login) work without further configuration.

## Verification

Every download is checked against the build provenance attestation that kubri's release workflow
publishes for it, so releases published before attestations were introduced cannot be installed.

## Installing only

To run kubri commands yourself, install it and add it to `PATH`:

```yaml
- uses: kubri/kubri-action@v1
  with:
    install-only: true

- run: kubri keys public pgp > key.asc
```
