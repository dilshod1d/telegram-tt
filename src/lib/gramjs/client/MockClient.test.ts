import BigInt from 'big-integer';

import Api from '../tl/api';
import MockClient from './MockClient';

describe('offline client fixtures', () => {
  let client: MockClient;
  beforeEach(async () => {
    client = new MockClient();
    await client.loadScenario('people');
  });

  it('loads optional collections and uses the pinned folder and app-config response schema', async () => {
    expect(client.mockData.documents).toEqual([]);
    expect(client.mockData.topPeers).toEqual([]);
    const result = await client.invoke(new Api.messages.GetDialogFilters());
    expect(result).toBeInstanceOf(Api.messages.DialogFilters);
    expect((result as Api.messages.DialogFilters).filters).toHaveLength(1);
    expect(await client.invoke(new Api.help.GetAppConfig({ hash: 0 }))).toBeInstanceOf(Api.help.AppConfig);
    const colors = await client.invoke(new Api.help.GetPeerColors({ hash: 0 })) as Api.help.PeerColors;
    expect(colors.colors).toHaveLength(7);
    const state = await client.invoke(new Api.updates.GetState()) as Api.updates.State;
    expect(state.date).toBeGreaterThan(0);
    const self = await client.invoke(new Api.users.GetFullUser({ id: new Api.InputUserSelf() }));
    expect((self as Api.users.UserFull).users[0].id.toString()).toBe('1');
  });

  it('keeps pin, mute, archive and unread metadata, and pages without duplicating pins', async () => {
    const dialogs = client.getDialogs();
    expect(dialogs.find((dialog) => dialog.peer instanceof Api.PeerUser && dialog.peer.userId.equals(12))
      ?.notifySettings.muteUntil).toBe(2147483647);
    expect(client.getDialogs('archived')[0].folderId).toBe(1);
    const first = await client.invoke(new Api.messages.GetDialogs({
      offsetPeer: new Api.InputPeerEmpty(), limit: 3, excludePinned: true,
    })) as Api.messages.DialogsSlice;
    expect(first.count).toBe(8);
    expect(first.dialogs).toHaveLength(3);
    expect(first.dialogs.some((dialog) => (dialog as Api.Dialog).pinned)).toBe(false);
    const next = await client.invoke(new Api.messages.GetDialogs({
      offsetPeer: new Api.InputPeerUser({ userId: BigInt(13), accessHash: BigInt(1) }),
      limit: 100, excludePinned: true,
    })) as Api.messages.DialogsSlice;
    expect(next.dialogs).toHaveLength(3);
    const pinned = await client.invoke(new Api.messages.GetPinnedDialogs({})) as Api.messages.PeerDialogs;
    expect(pinned.dialogs).toHaveLength(2);
  });

  it('emits read updates and moves dialogs to archive through ordinary requests', async () => {
    const updates: Api.TypeUpdate[] = [];
    client.addEventHandler((update: Api.TypeUpdate) => updates.push(update), { build: (update: unknown) => update });
    const peer = new Api.InputPeerUser({ userId: BigInt(11), accessHash: BigInt(1) });
    await client.invoke(new Api.messages.ReadHistory({ peer, maxId: 11 }));
    expect(client.mockData.dialogs.active.find((dialog) => dialog.id === '11')?.unreadCount).toBe(0);
    expect(updates[0]).toBeInstanceOf(Api.UpdateReadHistoryInbox);
    await client.invoke(new Api.folders.EditPeerFolders({
      folderPeers: [new Api.InputFolderPeer({ peer, folderId: 1 })],
    }));
    expect(client.mockData.dialogs.active.some((dialog) => dialog.id === '11')).toBe(false);
    expect(client.mockData.dialogs.archived.some((dialog) => dialog.id === '11')).toBe(true);
  });

  it('rejects an unknown scenario instead of retrying forever', async () => {
    await expect(client.loadScenario('missing-people-fixture')).rejects.toThrow();
  });
});
