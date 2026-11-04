import Api from '../../tl/api';

export default function getIdFromInputPeer(peer: Api.TypeInputPeer | Api.TypeInputChannel | Api.TypePeer) {
    if (peer instanceof Api.InputPeerEmpty) return undefined;

    if (peer instanceof Api.InputPeerChannel || peer instanceof Api.InputChannel || peer instanceof Api.PeerChannel) {
        return (Number(peer.channelId.toString()) - 1000000000).toString();
    }

    if (peer instanceof Api.InputPeerUser || peer instanceof Api.PeerUser) {
        return peer.userId.toString();
    }

    if (peer instanceof Api.InputPeerChat || peer instanceof Api.PeerChat) {
        return peer.chatId.toString();
    }

    throw Error(`Unknown peer type${peer.className}`);
}
