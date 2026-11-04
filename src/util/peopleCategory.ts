import type { ApiUser } from '../api/types';

import {
  ALL_FOLDER_ID, ANONYMOUS_USER_ID, PEOPLE_FOLDER_ID, REPLIES_USER_ID, SERVICE_NOTIFICATIONS_USER_ID,
  VERIFICATION_CODES_USER_ID,
} from '../config';

const SERVICE_USER_IDS = new Set([
  ANONYMOUS_USER_ID, REPLIES_USER_ID, SERVICE_NOTIFICATIONS_USER_ID, VERIFICATION_CODES_USER_ID,
  '333000', '42777', '708513',
]);

export function getChatFolderDisplayOrder(orderedIds?: number[]) {
  const result = orderedIds?.length ? [...orderedIds] : [ALL_FOLDER_ID];
  result.splice(1, 0, PEOPLE_FOLDER_ID);
  return result;
}

export function isPeopleUser(user: ApiUser | undefined, currentUserId?: string) {
  return Boolean(user && !user.isSelf && user.id !== currentUserId && !user.isSupport
    && (user.type === 'userTypeRegular' || user.type === 'userTypeDeleted')
    && !SERVICE_USER_IDS.has(user.id));
}
