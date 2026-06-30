const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuditUserDisplayInput = {
  id?: string | null;
  name?: string | null;
  currentUser?: {
    id?: string | null;
    name?: string | null;
  };
  directory?: Map<string, string>;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function formatAuditUserDisplay({
  id,
  name,
  currentUser,
  directory,
}: AuditUserDisplayInput) {
  const displayName = clean(name);
  if (displayName) {
    return displayName;
  }

  const userId = clean(id);
  if (!userId) {
    return "-";
  }

  const directoryName = clean(directory?.get(userId));
  if (directoryName) {
    return directoryName;
  }

  if (userId === clean(currentUser?.id)) {
    return clean(currentUser?.name) ?? "-";
  }

  return UUID_PATTERN.test(userId) ? "-" : userId;
}

export function buildAuditUserDirectory(users: Array<{ id?: string; name?: string }>) {
  const directory = new Map<string, string>();
  for (const user of users) {
    const id = clean(user.id);
    const name = clean(user.name);
    if (id && name) {
      directory.set(id, name);
    }
  }
  return directory;
}
