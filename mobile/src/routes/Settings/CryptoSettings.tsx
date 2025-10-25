import {
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Switch,
} from '@mui/material';
import { type ChangeEvent, useCallback, useState } from 'react';
import { useAtomValue } from 'jotai';
import { changeCryptoEnable } from 'tauri-plugin-data';

import ChangeCryptoPassword from '@/components/ChangeCryptoPassword';
import { cryptoIsEnableAtom } from '@/atom/cryptoAtom';
import IniCrypto from '@/components/InitCrypto';

export default function CryptoSettings() {
  const cryptoEnable = useAtomValue(cryptoIsEnableAtom);

  const [initCryptoIsOpen, setInitCryptoIsOpen] = useState(false);

  const onCryptoEnableChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setInitCryptoIsOpen(true);
    } else {
      changeCryptoEnable({
        cryptoEnable: false,
      });
    }
  }, []);

  const onInitCryptoCancel = useCallback(() => {
    setInitCryptoIsOpen(false);
  }, []);

  const onInitCryptoOk = useCallback(() => {
    setInitCryptoIsOpen(false);
  }, []);

  const [changeCryptoPasswordIsOpen, setChangeCryptoPasswordIsOpen] =
    useState(false);

  const onChangeCryptoPassword = useCallback(() => {
    setChangeCryptoPasswordIsOpen(true);
  }, []);

  const onChangeCryptoPasswordCancel = useCallback(() => {
    setChangeCryptoPasswordIsOpen(false);
  }, []);

  const onChangeCryptoPasswordOk = useCallback(() => {
    setChangeCryptoPasswordIsOpen(false);
  }, []);

  return (
    <>
      <List>
        <ListItem>
          <ListItemText primary="Crypto Enable" />
          <Switch checked={cryptoEnable} onChange={onCryptoEnableChange} />
        </ListItem>
        {cryptoEnable && (
          <>
            <ListItem>
              <ListItemText primary="Change Crypto Password" />
              <IconButton onClick={onChangeCryptoPassword}>
                <Icon className="icon-arrow-right" />
              </IconButton>
            </ListItem>
          </>
        )}
      </List>
      <IniCrypto
        open={initCryptoIsOpen}
        onCancel={onInitCryptoCancel}
        onOk={onInitCryptoOk}
      ></IniCrypto>
      <ChangeCryptoPassword
        open={changeCryptoPasswordIsOpen}
        onCancel={onChangeCryptoPasswordCancel}
        onOk={onChangeCryptoPasswordOk}
      ></ChangeCryptoPassword>
    </>
  );
}
