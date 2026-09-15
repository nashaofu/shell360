import { Button, Switch, Text } from "@radix-ui/themes";
import { changeCryptoEnable } from "bridge/data";
import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { ArrowRightIcon } from "shared";
import {
  cryptoIsEnableAtom,
  useUpdateCryptoIsEnable,
} from "@/atoms/crypto.atom";
import ChangeCryptoPassword from "@/components/ChangeCryptoPassword";
import InitCrypto from "@/components/InitCrypto";
import styles from "./index.module.less";

export default function CryptoSettings() {
  const cryptoEnable = useAtomValue(cryptoIsEnableAtom);
  const updateCryptoIsEnable = useUpdateCryptoIsEnable();

  const [initCryptoIsOpen, setInitCryptoIsOpen] = useState(false);

  const onCryptoEnableChange = useCallback(
    async (checked: boolean) => {
      if (checked) {
        setInitCryptoIsOpen(true);
      } else {
        await changeCryptoEnable({
          cryptoEnable: false,
        });
        await updateCryptoIsEnable();
      }
    },
    [updateCryptoIsEnable],
  );

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
      <div className={styles.row}>
        <Text size="2">Crypto Enable</Text>
        <Switch checked={cryptoEnable} onCheckedChange={onCryptoEnableChange} />
      </div>
      {cryptoEnable && (
        <div className={styles.row}>
          <Text size="2">Change Crypto Password</Text>
          <Button
            type="button"
            variant="ghost"
            color="gray"
            onClick={onChangeCryptoPassword}
          >
            <ArrowRightIcon />
          </Button>
        </div>
      )}
      <InitCrypto
        open={initCryptoIsOpen}
        onCancel={onInitCryptoCancel}
        onOk={onInitCryptoOk}
      />
      <ChangeCryptoPassword
        open={changeCryptoPasswordIsOpen}
        onCancel={onChangeCryptoPasswordCancel}
        onOk={onChangeCryptoPasswordOk}
      />
    </>
  );
}
