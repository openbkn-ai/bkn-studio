# Permission Request Deep Links

External integrations, including agents, can take a user to an object type's
permission request dialog with the `requestPermission` query parameter.

## URL format

```text
/studio/knowledge-network/workspace/{knowledge_network_id}/object-types/{object_type_id}/detail?requestPermission={target}
```

## Supported targets

| `target` | Dialog tab                    | Use when                                                               |
| -------- | ----------------------------- | ---------------------------------------------------------------------- |
| `1`      | Base permissions              | A required object operation, such as query or modify, is unavailable.  |
| `2`      | Request row access            | The user's row-filter scope cannot cover the data needed for the task. |
| `3`      | Request original field values | A required field's original value is unavailable.                      |

Only `1`, `2`, and `3` open the dialog. Unsupported values leave the page
unchanged. If the requested row or field scope is not available for the user,
Studio opens the dialog on the base-permissions tab instead.

## Integration requirements

- Use only the resource identifiers and target above in the URL. Do not encode
  user identity, reviewer identity, or permission decisions in query parameters.
- Studio and BKN Safe remain the authority for whether an application entry is
  visible and which permissions may be requested.
- An agent should display an application link only after a backend permission
  response explicitly identifies the missing scope. An empty result alone does
  not prove that a row-filter scope is insufficient.
