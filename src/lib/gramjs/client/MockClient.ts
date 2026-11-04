import BigInt from 'big-integer';

import type { DownloadFileWithDcParams } from './downloadFile';
import type { MockTypes } from './mockUtils/MockTypes';
import { MOCK_STARTING_DATE } from './mockUtils/MockTypes';
import type { SizeType } from './TelegramClient';

import { GENERAL_TOPIC_ID } from '../../../config';
import readFallbackStrings from '../../../util/data/readFallbackStrings';
import { UpdateConnectionState } from '../network';
import Api from '../tl/api';
import createMockedAvailableReaction from './mockUtils/createMockedAvailableReaction';
import createMockedChannel from './mockUtils/createMockedChannel';
import createMockedChat from './mockUtils/createMockedChat';
import createMockedDialog from './mockUtils/createMockedDialog';
import createMockedDialogFilter from './mockUtils/createMockedDialogFilter';
import createMockedForumTopic from './mockUtils/createMockedForumTopic';
import createMockedJSON from './mockUtils/createMockedJSON';
import createMockedMessage from './mockUtils/createMockedMessage';
import createMockedTypePeer from './mockUtils/createMockedTypePeer';
import createMockedUser from './mockUtils/createMockedUser';
import getDocumentIdFromLocation from './mockUtils/getDocumentIdFromLocation';
import getIdFromInputPeer from './mockUtils/getIdFromInputPeer';
import { downloadFile } from './downloadFile';

import MockSender from './MockSender';

const sizeTypes: SizeType[] = ['u', 'v', 'w', 'y', 'd', 'x', 'c', 'm', 'b', 'a', 's', 'f'];

class TelegramClient {
    private invokeMiddleware?: <A, R>(mockClient: TelegramClient, request: Api.Request<A, R>)
    => Promise<R | undefined | 'pass'>;

    public mockData: MockTypes = {
        users: [],
        chats: [],
        channels: [],
        dialogFilters: [],
        dialogs: {
            active: [],
            archived: [],
        },
        messages: {},
        availableReactions: [],
        documents: [],
        topPeers: [],
    };

    private _log: {};

    constructor() {
        this._log = {
            info: () => {},
        };
    }

    private callbacks: {
        callback: any;
        eventBuilder: any;
    }[] = [];

    addEventHandler(callback: any, eventBuilder: any) {
        this.callbacks.push({
            callback,
            eventBuilder,
        });
    }

    async loadScenario(scenario = 'default'): Promise<void> {
        this.invokeMiddleware = undefined;
        try {
            const invokeMiddleware = await import(`./__invokeMiddlewares__/${scenario}`);

            this.invokeMiddleware = invokeMiddleware.default;
        } catch (e) {
            // Ignore and use the default logic
        }
        return import(`./__mocks__/${scenario}.json`).then(async (module) => {
            const mockData = (module.default || module) as Partial<MockTypes>;
            this.mockData = {
                users: [], chats: [], channels: [], dialogFilters: [], messages: {},
                availableReactions: [], documents: [], topPeers: [],
                ...mockData,
                dialogs: { active: [], archived: [], ...mockData.dialogs },
            };
            await Promise.all(this.mockData.documents.map(async (l, i) => {
                const response = await import(`./__data__/${l.url}`).then((module) => fetch(module.default));
                const bytes = await response.arrayBuffer();
                this.mockData.documents[i].size = BigInt(bytes.byteLength);
                this.mockData.documents[i].bytes = Buffer.from(new Uint8Array(bytes));
            }));

            this.callbacks.forEach(({ eventBuilder, callback }) => (callback(
                eventBuilder.build(new UpdateConnectionState(UpdateConnectionState.connected)),
            )));
        });
    }

    fireUpdate(update: Api.TypeUpdate) {
        this.callbacks.forEach(({ eventBuilder, callback }) => (callback(eventBuilder.build(update))));
    }

    getUser(id: string) {
        return createMockedUser(id, this.mockData);
    }

    getDialogs(type: 'active' | 'archived' = 'active') {
        return this.mockData.dialogs[type].map((dialog) => createMockedDialog(dialog.id, this.mockData));
    }

    start({
        mockScenario,
    }: {
        mockScenario: string;
    }) {
        return this.loadScenario(mockScenario);
    }

    async invoke<A, R>(request: Api.Request<A, R>) {
        if (this.invokeMiddleware) {
            const a = await this.invokeMiddleware(this, request);
            if (a !== 'pass') {
                return a;
            }
        }

        if (request instanceof Api.help.GetAppConfig) {
            return new Api.help.AppConfig({ hash: 1, config: createMockedJSON(this.mockData.appConfig || {}) });
        }

        if (request instanceof Api.help.GetPeerColors) {
            const colors = [0xcc5049, 0xd67722, 0x955cdb, 0x40a920, 0x309eba, 0x368ad1, 0xc7508b];
            return new Api.help.PeerColors({
                hash: 1,
                colors: colors.map((color, colorId) => new Api.help.PeerColorOption({
                    colorId,
                    colors: new Api.help.PeerColorSet({ colors: [color] }),
                    darkColors: new Api.help.PeerColorSet({ colors: [color] }),
                })),
            });
        }

        if (request instanceof Api.langpack.GetLangPack) {
            const { langPack } = await readFallbackStrings();
            return new Api.LangPackDifference({
                langCode: 'en', fromVersion: 0, version: 1,
                strings: Object.entries(langPack.strings).map(([key, value]) => (
                    typeof value === 'string' ? new Api.LangPackString({ key, value })
                        : 'isDeleted' in value ? new Api.LangPackStringDeleted({ key })
                        : new Api.LangPackStringPluralized({ key, otherValue: value.other || '',
                            zeroValue: value.zero, oneValue: value.one, twoValue: value.two,
                            fewValue: value.few, manyValue: value.many })
                )),
            });
        }

        if (request instanceof Api.updates.GetState) {
            return new Api.updates.State({ pts: 0, qts: 0, date: MOCK_STARTING_DATE, seq: 0, unreadCount: 0 });
        }

        if (request instanceof Api.updates.GetDifference) {
            return new Api.updates.DifferenceEmpty({ date: MOCK_STARTING_DATE, seq: 0 });
        }

        if (request instanceof Api.messages.GetSavedDialogs) {
            return new Api.messages.SavedDialogs({ dialogs: [], users: [], chats: [], messages: [] });
        }

        if (request instanceof Api.contacts.GetContacts) {
            return new Api.contacts.Contacts({
                contacts: [], savedCount: 0, users: this.getUsers().filter((user) => user.contact),
            });
        }

        if (request instanceof Api.messages.ReadHistory) {
            const id = getIdFromInputPeer(request.peer);
            const dialog = [...this.mockData.dialogs.active, ...this.mockData.dialogs.archived]
                .find((entry) => entry.id === id);
            if (!dialog) return undefined;
            dialog.readInboxMaxId = request.maxId || dialog.topMessage || 0;
            dialog.unreadCount = 0;
            this.fireUpdate(new Api.UpdateReadHistoryInbox({
                peer: createMockedTypePeer(dialog.id, this.mockData),
                maxId: dialog.readInboxMaxId, stillUnreadCount: 0, pts: 0, ptsCount: 0,
            }));
            return new Api.messages.AffectedMessages({ pts: 0, ptsCount: 0 });
        }

        if (request instanceof Api.folders.EditPeerFolders) {
            const folderPeers: Api.FolderPeer[] = [];
            request.folderPeers.forEach(({ peer, folderId }) => {
                const id = getIdFromInputPeer(peer);
                const dialog = [...this.mockData.dialogs.active, ...this.mockData.dialogs.archived]
                    .find((entry) => entry.id === id);
                if (!dialog) return;
                this.mockData.dialogs.active = this.mockData.dialogs.active.filter((entry) => entry.id !== id);
                this.mockData.dialogs.archived = this.mockData.dialogs.archived.filter((entry) => entry.id !== id);
                this.mockData.dialogs[folderId === 1 ? 'archived' : 'active'].push(dialog);
                folderPeers.push(new Api.FolderPeer({ peer: createMockedTypePeer(dialog.id, this.mockData), folderId }));
            });
            const update = new Api.UpdateFolderPeers({ folderPeers, pts: 0, ptsCount: 0 });
            return new Api.Updates({ updates: [update], users: [], chats: [], date: 0, seq: 0 });
        }

        if (request instanceof Api.messages.ToggleDialogPin) {
            const id = getIdFromInputPeer((request.peer as Api.InputDialogPeer).peer);
            const dialog = this.mockData.dialogs.active.find((entry) => entry.id === id);
            if (!dialog) return undefined;
            dialog.pinned = request.pinned;
            this.fireUpdate(new Api.UpdateDialogPinned({
                pinned: request.pinned,
                peer: new Api.DialogPeer({ peer: createMockedTypePeer(dialog.id, this.mockData) }),
            }));
            return true;
        }

        if (request instanceof Api.messages.GetDiscussionMessage) {
            const peerId = getIdFromInputPeer(request.peer);
            if (!peerId) return undefined;

            return new Api.messages.DiscussionMessage({
                messages: this.getMessagesFrom(peerId).filter((l) => l.id === request.msgId),
                unreadCount: 0,
                chats: [],
                users: [],
            });
        }

        if (request instanceof Api.messages.GetReplies) {
            const peerId = getIdFromInputPeer(request.peer);
            if (!peerId) return undefined;

            const messages = this.mockData.messages[peerId].filter((message) => message.replyToTopId === request.msgId);
            return new Api.messages.Messages({
                messages: messages.map((message) => createMockedMessage(peerId, message.id, this.mockData)),
                chats: [],
                users: [],
            });
        }

        if (request instanceof Api.contacts.GetTopPeers) {
            return new Api.contacts.TopPeers({
                categories: [new Api.TopPeerCategoryPeers({
                    category: new Api.TopPeerCategoryCorrespondents(),
                    count: this.mockData.topPeers.length,
                    peers: this.mockData.topPeers.map((id) => {
                        return new Api.TopPeer({
                            peer: createMockedTypePeer(id, this.mockData),
                            rating: 100,
                        });
                    }),
                })],
                chats: [],
                users: this.getUsers(),
            });
        }

        if (request instanceof Api.channels.GetForumTopics) {
            const channelId = getIdFromInputPeer(request.channel);
            if (!channelId) return undefined;

            const topics = this.getChannel(channelId)?.forumTopics;

            if (!topics) return undefined;

            const hasGeneralTopic = topics.some((l) => l.id === GENERAL_TOPIC_ID);
            const offsetTopicId = request.offsetTopic;
            const limit = request.limit;
            return new Api.messages.ForumTopics({
                topics: topics
                    .sort((a, b) => b.id - a.id)
                    .map((topic) => {
                        return createMockedForumTopic(channelId, topic.id, this.mockData);
                    }).filter((topic) => {
                        if (offsetTopicId) {
                            return topic.id < offsetTopicId;
                        }
                        return true;
                    }).slice(0, limit),
                users: [],
                chats: [],
                messages: [],
                pts: 0,
                count: topics.length - (hasGeneralTopic ? 1 : 0),
            });
        }

        if (request instanceof Api.users.GetFullUser) {
            const user = request.id instanceof Api.InputUserSelf
                ? this.mockData.users.find((entry) => entry.self)
                : this.mockData.users.find((entry) => entry.id === (request.id as Api.InputUser).userId?.toString());
            if (!user) return undefined;
            return new Api.users.UserFull({
                fullUser: new Api.UserFull({
                    about: 'lol',
                    settings: new Api.PeerSettings({}),
                    notifySettings: new Api.PeerNotifySettings({}),
                    id: BigInt(user.id),
                    commonChatsCount: 0,
                }),
                chats: [],
                users: [this.getUser(user.id)],
            });
        }

        if (request instanceof Api.messages.GetAvailableReactions) {
            return new Api.messages.AvailableReactions({
                reactions: this.mockData.availableReactions.map((reaction) => {
                    return createMockedAvailableReaction(reaction, this.mockData);
                }),
                hash: 1,
            });
        }

        if (request instanceof Api.messages.GetHistory) {
            const peerId = getIdFromInputPeer(request.peer);
            if (!peerId) return undefined;

            return new Api.messages.Messages({
                messages: this.getMessagesFrom(peerId),
                chats: [],
                users: [],
            });
        }

        if (request instanceof Api.upload.GetFile) {
            const fileId = getDocumentIdFromLocation(request.location);
            if (fileId === undefined) return undefined;

            return new Api.upload.File({
                type: new Api.storage.FileUnknown(),
                mtime: 0,
                bytes: Buffer.from(new Uint8Array(this.mockData.documents.find((i) => i.id === fileId)!.bytes)),
            });
        }

        if (request instanceof Api.messages.GetDialogFilters) {
            return new Api.messages.DialogFilters({ filters: [
                new Api.DialogFilterDefault(),
                ...this.mockData.dialogFilters
                    .map((dialogFilter) => createMockedDialogFilter(dialogFilter.id, this.mockData)),
            ] });
        }

        if (request instanceof Api.messages.GetPinnedDialogs) {
            return new Api.messages.PeerDialogs({
                dialogs: this.getDialogs(request.folderId === 1 ? 'archived' : 'active').filter((dialog) => dialog.pinned),
                chats: this.getChatsAndChannels(),
                messages: this.getAllMessages(),
                users: this.getUsers(),
                state: new Api.updates.State({
                    pts: 0,
                    qts: 0,
                    date: MOCK_STARTING_DATE,
                    seq: 0,
                    unreadCount: 0,
                }),
            });
        }

        if (request instanceof Api.messages.GetDialogs) {
            const allDialogs = this.getDialogs(request.folderId === 1 ? 'archived' : 'active');
            const dialogs = allDialogs.filter((dialog) => !request.excludePinned || !dialog.pinned);
            const offsetId = getIdFromInputPeer(request.offsetPeer);
            const offset = offsetId ? dialogs.findIndex((dialog) => (
                getIdFromInputPeer(dialog.peer) === offsetId
            )) + 1 : 0;
            return new Api.messages.DialogsSlice({
                count: allDialogs.length,
                dialogs: dialogs.slice(offset, offset + request.limit),
                messages: this.getAllMessages(),
                chats: this.getChatsAndChannels(),
                users: this.getUsers(),
            });
        }
        return undefined;
    }

    public getSender() {
        return new MockSender(this);
    }

    downloadFile(inputLocation: any, args: DownloadFileWithDcParams) {
        return downloadFile(this as any, inputLocation, args);
    }

    _downloadPhoto(photo: Api.MessageMediaPhoto | Api.TypePhoto | undefined, args: any) {
        if (photo instanceof Api.MessageMediaPhoto) {
            photo = photo.photo;
        }
        if (!(photo instanceof Api.Photo)) {
            return undefined;
        }
        const isVideoSize = args.sizeType === 'u' || args.sizeType === 'v';
        const size = this._pickFileSize(isVideoSize
            ? [...(photo.videoSizes as any), ...photo.sizes]
            : photo.sizes, args.sizeType);
        if (!size || (size instanceof Api.PhotoSizeEmpty)) {
            return undefined;
        }

        if (size instanceof Api.PhotoCachedSize || size instanceof Api.PhotoStrippedSize) {
            // TODO[mock] Implement
            // return this._downloadCachedPhotoSize(size);
            return undefined;
        }
        return this.downloadFile(
            new Api.InputPhotoFileLocation({
                id: photo.id,
                accessHash: photo.accessHash,
                fileReference: photo.fileReference,
                thumbSize: size.type,
            }),
            {
                dcId: photo.dcId,
                fileSize: size.size || Math.max(...(size.sizes || [])),
                progressCallback: args.progressCallback,
            },
        );
    }

    downloadMedia(messageOrMedia: any, args: any) {
        let media;
        if (messageOrMedia instanceof Api.Message) {
            media = messageOrMedia.media;
        } else {
            media = messageOrMedia;
        }
        if (typeof media === 'string') {
            throw new Error('not implemented');
        }

        if (media instanceof Api.MessageMediaWebPage) {
            if (media.webpage instanceof Api.WebPage) {
                media = media.webpage.document || media.webpage.photo;
            }
        }
        if (media instanceof Api.MessageMediaPhoto || media instanceof Api.Photo) {
            return this._downloadPhoto(media, args);
        } else if (media instanceof Api.MessageMediaDocument || media instanceof Api.Document) {
            return this._downloadDocument(media, args);
        } else if (media instanceof Api.MessageMediaContact) {
            return undefined;
        } else if (media instanceof Api.WebDocument || media instanceof Api.WebDocumentNoProxy) {
            return undefined;
        }
        return undefined;
    }

    _downloadDocument(doc: any, args: any) {
        if (doc instanceof Api.MessageMediaDocument) {
            doc = doc.document;
        }
        if (!(doc instanceof Api.Document)) {
            return undefined;
        }

        let size;
        if (args.sizeType) {
            size = doc.thumbs ? this._pickFileSize([...(doc.videoThumbs || []),
                ...doc.thumbs], args.sizeType) : undefined;
            if (!size && doc.mimeType.startsWith('video/')) {
                return undefined;
            }

            if (size && (size instanceof Api.PhotoCachedSize
                || size instanceof Api.PhotoStrippedSize)) {
                // TODO[mock] Implement
                // return this._downloadCachedPhotoSize(size);
                return undefined;
            }
        }

        return this.downloadFile(
            new Api.InputDocumentFileLocation({
                id: doc.id,
                accessHash: doc.accessHash,
                fileReference: doc.fileReference,
                thumbSize: size ? size.type : '',
            }),
            {
                fileSize: size ? size.size : doc.size.toJSNumber(),
                progressCallback: args.progressCallback,
                start: args.start,
                end: args.end,
                dcId: doc.dcId,
                workers: args.workers,
            },
        );
    }

    _pickFileSize(sizes: any, sizeType: any) {
        if (!sizeType || !sizes || !sizes.length) {
            return undefined;
        }
        const indexOfSize = sizeTypes.indexOf(sizeType);
        let size;
        for (let i = indexOfSize; i < sizeTypes.length; i++) {
            size = sizes.find((s: any) => s.type === sizeTypes[i]);
            if (size) {
                return size;
            }
        }
        return undefined;
    }

    public setPingCallback() {}

    public setShouldDebugExportedSenders() {}

    public setIsPremium() {}

    public async destroy() {}

    public async disconnect() {}

    public isConnected() {
        return true;
    }

    public releaseExportedSender() {}

    private getMessagesFrom(chatId: string) {
        return (this.mockData.messages[chatId] || []).map((message) => createMockedMessage(chatId, message.id, this.mockData));
    }

    private getAllMessages() {
        return Object.entries(this.mockData.messages).flatMap(([chatId, messages]) => {
            return messages.map((message) => createMockedMessage(chatId, message.id, this.mockData));
        });
    }

    private getChatsAndChannels() {
        return [...this.getChannels(), ...this.getChats()];
    }

    private getChats() {
        return this.mockData.chats.map((chat) => createMockedChat(chat.id, this.mockData));
    }

    private getChannel(chatId: string) {
        return this.mockData.channels.find((channel) => channel.id === chatId);
    }

    private getChannels() {
        return this.mockData.channels.map((channel) => createMockedChannel(channel.id, this.mockData));
    }

    private getUsers() {
        return this.mockData.users.map((user) => createMockedUser(user.id, this.mockData));
    }
}

export default TelegramClient;
