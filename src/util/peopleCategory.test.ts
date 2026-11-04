import type { ApiChat, ApiUser } from '../api/types';
import type { GlobalState } from '../global/types';

import { ALL_FOLDER_ID, PEOPLE_FOLDER_ID } from '../config';
import {
  addOrderedIdsCallback, getOrderedIds, getPinnedChatsCount, getUnreadCounters, init,
} from './folderManager';
import { getChatFolderDisplayOrder, isPeopleUser } from './peopleCategory';

let mockGlobal: GlobalState;
let mockTick: () => void;
let mockReset: () => void;
const mockMuted = new Set<string>();

jest.mock('../lib/teact/teact', () => ({ onFullyIdle: (callback: () => void) => callback() }));
jest.mock('../lib/teact/teactn', () => ({
  addCallback: (callback: () => void) => { mockTick = callback; },
}));
jest.mock('../global', () => ({
  getGlobal: () => mockGlobal,
  addActionHandler: (_: string, callback: () => void) => { mockReset = callback; },
}));
jest.mock('../global/selectors', () => ({
  selectTabState: () => ({ isMasterTab: true }),
  selectChatLastMessage: () => undefined,
  selectNotifyDefaults: () => undefined,
  selectTopics: () => undefined,
}));
jest.mock('../global/helpers/notifications', () => ({
  getIsChatMuted: (value: ApiChat) => mockMuted.has(value.id),
}));
jest.mock('./schedulers', () => ({ throttle: (callback: () => void) => callback }));

function user(id: string, props: Partial<ApiUser> = {}): ApiUser {
  return {
    id, type: 'userTypeRegular', isMin: false, phoneNumber: '', ...props,
  };
}

function chat(id: string, props: Partial<ApiChat> = {}): ApiChat {
  return {
    id, type: 'chatTypePrivate', creationDate: Number(id), ...props,
  } as ApiChat;
}

function account(chats: ApiChat[], users: ApiUser[], pinned: string[] = [], fullyLoaded = true): GlobalState {
  return {
    currentUserId: '1000',
    chats: {
      byId: Object.fromEntries(chats.map((value) => [value.id, value])),
      listIds: { active: chats.map(({ id }) => id) },
      orderedPinnedIds: { active: pinned },
      isFullyLoaded: { active: fullyLoaded },
      lastMessageIds: {},
      topicsInfoById: {},
    },
    users: { byId: Object.fromEntries(users.map((value) => [value.id, value])) },
    chatFolders: { byId: {} },
  } as unknown as GlobalState;
}

beforeEach(() => {
  mockMuted.clear();
  mockReset?.();
});

test('always offers People after the first category without changing synced order', () => {
  expect(getChatFolderDisplayOrder()).toEqual([ALL_FOLDER_ID, PEOPLE_FOLDER_ID]);
  expect(getChatFolderDisplayOrder([])).toEqual([ALL_FOLDER_ID, PEOPLE_FOLDER_ID]);
  const synced = [10, ALL_FOLDER_ID, 20];
  expect(getChatFolderDisplayOrder(synced)).toEqual([10, PEOPLE_FOLDER_ID, ALL_FOLDER_ID, 20]);
  expect(synced).toEqual([10, ALL_FOLDER_ID, 20]);
});

test('includes people and historical conversations while excluding system identities and unresolved users', () => {
  expect(isPeopleUser(user('11', { isContact: true }), '1000')).toBe(true);
  expect(isPeopleUser(user('12'), '1000')).toBe(true);
  expect(isPeopleUser(user('13', { type: 'userTypeDeleted' }), '1000')).toBe(true);
  [
    undefined,
    user('11', { type: 'userTypeBot' }),
    user('11', { type: 'userTypeUnknown' }),
    user('11', { isSupport: true }),
    user('11', { isSelf: true }),
    user('1000'),
    ...['333000', '777000', '42777', '489000', '708513', '1271266957', '2666000'].map((id) => user(id)),
  ].forEach((value) => expect(isPeopleUser(value, '1000')).toBe(false));
});

test('projects membership, main-list pins, and muted unread counters without creating a server folder', () => {
  mockMuted.add('12');
  const users = [
    user('11', { isContact: true }), user('12'), user('13'), user('14', { type: 'userTypeBot' }), user('1000'),
  ];
  mockGlobal = account([
    chat('11'), chat('12', { unreadCount: 3 }), chat('13', { folderId: 1 }),
    chat('14'), chat('1000'), chat('-1', { type: 'chatTypeBasicGroup' }),
    chat('-2', { type: 'chatTypeChannel' }),
  ], users, ['14', '11']);
  init();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['11', '12']);
  expect(getPinnedChatsCount(PEOPLE_FOLDER_ID)).toBe(1);
  expect(getUnreadCounters()[PEOPLE_FOLDER_ID]).toEqual({ chatsCount: 1, notificationsCount: 0 });
  expect(mockGlobal.chatFolders.byId).toEqual({});
  mockGlobal.chats.orderedPinnedIds.active = ['12', '14', '11'];
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['12', '11']);
  expect(getPinnedChatsCount(PEOPLE_FOLDER_ID)).toBe(2);
  mockGlobal.chats.byId = { ...mockGlobal.chats.byId, 11: chat('11', { folderId: 1 }) };
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['12']);
  expect(getPinnedChatsCount(PEOPLE_FOLDER_ID)).toBe(1);
});

test('reacts to incoming chats, metadata resolution, reading, archiving, and deletion', () => {
  mockGlobal = account([chat('11'), chat('12')], [user('11'), user('12', { type: 'userTypeUnknown' })]);
  init();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['11']);
  mockGlobal.users.byId = { ...mockGlobal.users.byId, 12: user('12') };
  mockGlobal.chats.byId = { ...mockGlobal.chats.byId, 13: chat('13', { unreadCount: 2 }) };
  mockGlobal.users.byId = { ...mockGlobal.users.byId, 13: user('13') };
  mockGlobal.chats.listIds.active = ['11', '12', '13'];
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['13', '12', '11']);
  expect(getUnreadCounters()[PEOPLE_FOLDER_ID]?.chatsCount).toBe(1);
  expect(getUnreadCounters()[PEOPLE_FOLDER_ID]?.notificationsCount).toBe(2);
  mockMuted.add('13');
  mockGlobal.chats.notifyExceptionById = {};
  mockTick();
  expect(getUnreadCounters()[PEOPLE_FOLDER_ID]?.notificationsCount).toBe(0);
  mockGlobal.chats.byId = { ...mockGlobal.chats.byId, 11: chat('11', { folderId: 1 }), 13: chat('13') };
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['13', '12']);
  expect(getUnreadCounters()[PEOPLE_FOLDER_ID]?.chatsCount).toBe(0);
  mockGlobal.chats.listIds.active = ['11', '12'];
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['12']);
});

test('publishes the empty state only after main-list pagination completes', () => {
  mockGlobal = account([], [], [], false);
  init();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toBeUndefined();
  const changed = jest.fn();
  addOrderedIdsCallback(PEOPLE_FOLDER_ID, changed);
  mockGlobal.chats.isFullyLoaded.active = true;
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual([]);
  expect(changed).toHaveBeenCalledWith([]);
});

test('clears derived people and unread data when the account resets', () => {
  mockGlobal = account([chat('11', { unreadCount: 4 })], [user('11')]);
  init();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['11']);
  mockReset();
  mockGlobal = account([chat('22')], [user('22')]);
  mockTick();
  expect(getOrderedIds(PEOPLE_FOLDER_ID)).toEqual(['22']);
  expect(getUnreadCounters()[PEOPLE_FOLDER_ID]?.chatsCount).toBe(0);
});
