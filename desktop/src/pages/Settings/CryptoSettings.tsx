import { Button, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { changeCryptoEnable } from "tauri-plugin-data";
import { cryptoIsEnableAtom } from "@/app/model/cryptoAtom";
import ChangeCryptoPassword from "@/features/crypto/changeCryptoPassword";
import InitCrypto from "@/features/crypto/initCrypto";
import styles from "./index.module.less";

export default function CryptoSettings() {
  const cryptoEnable = useAtomValue(cryptoIsEnableAtom);

  const [initCryptoIsOpen, setInitCryptoIsOpen] = useState(false);

  const onCryptoEnableChange = useCallback((checked: boolean) => {
    if (checked) {
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
      <Flex align="center" justify="between" className={styles.cryptoRow}>
        <Flex as="span" align="center" className={styles.rowLeft}>
          <span className={`${styles.themeIcon} icon-lock`} />
          <Text as="span" className={styles.rowText}>
            Enable encryption
          </Text>
        </Flex>
        <Switch checked={cryptoEnable} onCheckedChange={onCryptoEnableChange} />
      </Flex>
      {cryptoEnable && (
        <Flex align="center" justify="between" className={styles.cryptoRow}>
          <Flex as="span" align="center" className={styles.rowLeft}>
            <span className={`${styles.themeIcon} icon-key`} />
            <Text as="span" className={styles.rowText}>
              Change encryption password
            </Text>
          </Flex>
          <Button
            type="button"
            variant="ghost"
            color="gray"
            onClick={onChangeCryptoPassword}
          >
            <span className="icon-arrow-right" />
          </Button>
        </Flex>
      )}
      <InitCrypto
        open={initCryptoIsOpen}
        onCancel={onInitCryptoCancel}
        onOk={onInitCryptoOk}
      ></InitCrypto>
      <ChangeCryptoPassword
        open={changeCryptoPasswordIsOpen}
        onCancel={onChangeCryptoPasswordCancel}
        onOk={onChangeCryptoPasswordOk}
      ></ChangeCryptoPassword>
    </>
  );
}
