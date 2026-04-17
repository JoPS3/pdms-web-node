async function smokeWrite(ctx, user, options = {}) {
  const token = await ctx.getValidAccessToken(user);
  if (!token.ok) {
    return { ok: false, reason: token.reason };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const moduleName = ctx.sanitizeModuleName(options.module);
  const dateParts = ctx.formatUtcDateParts(now);
  const fileName = `pdms-${moduleName}-${dateParts.stamp}.json`;
  const writePayload = {
    type: 'pdms-onedrive-smoke',
    module: moduleName,
    timestamp: nowIso,
    user: user.userName || user.id,
    data: options.payload && typeof options.payload === 'object' ? options.payload : {
      message: 'Teste de escrita PDMS OneDrive'
    }
  };

  const filePath = ctx.encodePathSegments(['pdms-smoke', moduleName, dateParts.year, dateParts.month, dateParts.day, fileName]);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${filePath}:/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(writePayload, null, 2)
  });

  const raw = await response.text();
  const payload = ctx.parseJsonPayload(raw);

  if (!response.ok) {
    return {
      ok: false,
      reason: 'graph_write_failed',
      message: payload?.error?.message || 'Falha ao escrever ficheiro de teste no OneDrive.'
    };
  }

  return {
    ok: true,
    file: {
      id: payload.id || null,
      name: payload.name || fileName,
      path: `pdms-smoke/${moduleName}/${dateParts.year}/${dateParts.month}/${dateParts.day}/${fileName}`,
      size: payload.size || null,
      webUrl: payload.webUrl || null,
      lastModifiedDateTime: payload.lastModifiedDateTime || null
    },
    expiresAt: token.expiresAt
  };
}

async function smokeRead(ctx, user, options = {}) {
  const token = await ctx.getValidAccessToken(user);
  if (!token.ok) {
    return { ok: false, reason: token.reason };
  }

  const moduleName = ctx.sanitizeModuleName(options.module);
  const top = Number(options.top) > 0 ? Math.min(Number(options.top), 50) : 20;
  const basePath = ctx.encodePathSegments(['pdms-smoke', moduleName]);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${basePath}:/children?$top=${top}&$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`
    }
  });

  const raw = await response.text();
  const payload = ctx.parseJsonPayload(raw);

  if (!response.ok) {
    if (response.status === 404 && payload?.error?.code === 'itemNotFound') {
      return {
        ok: true,
        module: moduleName,
        items: [],
        expiresAt: token.expiresAt
      };
    }

    return {
      ok: false,
      reason: 'graph_read_failed',
      message: payload?.error?.message || 'Falha ao ler ficheiros do OneDrive.'
    };
  }

  const items = Array.isArray(payload.value)
    ? payload.value.map((item) => ({
      id: item.id,
      name: item.name,
      size: item.size,
      type: item.folder ? 'folder' : 'file',
      lastModifiedDateTime: item.lastModifiedDateTime || null,
      webUrl: item.webUrl || null
    }))
    : [];

  return {
    ok: true,
    module: moduleName,
    items,
    expiresAt: token.expiresAt
  };
}

module.exports = {
  smokeWrite,
  smokeRead
};
