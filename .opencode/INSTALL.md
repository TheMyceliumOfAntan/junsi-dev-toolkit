# Installing junsi-dev-toolkit for OpenCode

## Installation

Add to `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["junsi-dev-toolkit@git+https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git"]
}
```

Or use a local path if cloned:

```json
{
  "plugin": ["E:/my-skill"]
}
```

Restart OpenCode. The plugin registers automatically.

## Verify

Say "加个功能" or "这个接口报错了" — AI should route to the appropriate sub-skill without `/skill` invocation.

## Updating

```bash
cd E:/my-skill && git pull
```
Or reinstall the npm package.
