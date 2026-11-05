import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import { getMediaFilename } from '../../global/helpers';
import { selectTabState } from '../../global/selectors';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import ConfirmDialog from '../ui/ConfirmDialog';

type StateProps = { warning?: NonNullable<TabState['apkDownloadWarnings']>[number] };

const ApkWarningModal = ({ warning }: StateProps) => {
  const { resolveApkDownloadWarning } = getActions();
  const lang = useOldLang();
  const handleClose = useLastCallback(() => resolveApkDownloadWarning({ shouldDownload: false }));
  const handleConfirm = useLastCallback(() => resolveApkDownloadWarning({ shouldDownload: true }));

  return (
    <ConfirmDialog
      isOpen={Boolean(warning)}
      title={lang('LocalSafetyApkTitle')}
      confirmLabel={lang('Continue')}
      confirmHandler={handleConfirm}
      onClose={handleClose}
    >
      <p>{lang('LocalSafetyApkText')}</p>
      <p dir="auto" className="word-break-all">{warning && getMediaFilename(warning.media)}</p>
    </ConfirmDialog>
  );
};

export default memo(withGlobal((global): StateProps => ({
  warning: selectTabState(global).apkDownloadWarnings?.[0],
}))(ApkWarningModal));
