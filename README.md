![Team Hub](images/logo.png)

**Full documentation:** [https://harborclient.github.io/team-hub/](https://harborclient.github.io/team-hub/)

**Linux CLI server for shared HarborClient storage and team workflows.**

`team-hub` is the central server companion to [HarborClient](https://github.com/harborclient/harborclient):

- **CLI-first:** Run and manage the server from the `team-hub` command.
- **Fastify HTTP API:** HTTP server scaffold ready for HarborClient desktop clients.
- **Configurable storage:** YAML-based server config with MySQL database support.

## Documentation

| Topic           | Link                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| Getting started | [Introduction](https://harborclient.github.io/team-hub/)               |
| Prerequisites   | [Prerequisites](https://harborclient.github.io/team-hub/prerequisites) |
| Setup           | [Setup](https://harborclient.github.io/team-hub/setup)                 |
| Development     | [Development](https://harborclient.github.io/team-hub/development)     |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

```bash
pnpm install
pnpm test
pnpm docs:serve    # VitePress dev server with nav watcher
pnpm docs:build    # production docs build
```

## License

MIT
