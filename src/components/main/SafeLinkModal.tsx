import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ensureProtocol } from '../../util/browser/url';
import { getLinkRisk } from '../../util/localSafety';
import renderText from '../common/helpers/renderText';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  url?: string;
};

const SafeLinkModal: FC<OwnProps> = ({ url }) => {
  const { toggleSafeLinkModal } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  const handleOpen = useCallback(() => {
    if (!url) {
      return;
    }

    window.open(ensureProtocol(url), '_blank', 'noopener noreferrer');
    toggleSafeLinkModal({ url: undefined });
  }, [toggleSafeLinkModal, url]);

  const handleDismiss = useCallback(() => {
    toggleSafeLinkModal({ url: undefined });
  }, [toggleSafeLinkModal]);

  const renderingUrl = useCurrentOrPrev(url);
  const risk = renderingUrl ? getLinkRisk(ensureProtocol(renderingUrl)!) : undefined;
  const parsed = risk ? new URL(ensureProtocol(renderingUrl!)!) : undefined;
  const riskKey = risk === 'login' ? 'LocalSafetyLinkLogin'
    : risk === 'direction' ? 'LocalSafetyLinkDirection' : 'LocalSafetyLinkMixed';

  return (
    <ConfirmDialog
      isOpen={Boolean(url)}
      onClose={handleDismiss}
      title={risk ? oldLang('LocalSafetyLinkTitle') : lang('OpenUrlTitle')}
      textParts={risk ? undefined
        : renderText(lang('OpenUrlText', { url: renderingUrl }, { withNodes: true, withMarkdown: true }))}
      confirmLabel={lang('OpenUrlConfirm')}
      confirmHandler={handleOpen}
    >
      {risk && (
        <>
          <p>{oldLang(riskKey)}</p>
          <p dir="ltr">{oldLang('LocalSafetyDestination', parsed!.hostname)}</p>
          <p dir="ltr" className="word-break-all">{parsed!.href}</p>
        </>
      )}
    </ConfirmDialog>
  );
};

export default memo(SafeLinkModal);
