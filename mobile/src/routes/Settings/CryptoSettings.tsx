import { Button, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { type CSSProperties, useCallback, useState } from "react";
import { ArrowRightIcon } from "shared";
import { changeCryptoEnable } from "tauri-plugin-data";
import { cryptoIsEnableAtom } from "@/atoms/crypto.atom";
import ChangeCryptoPassword from "@/components/ChangeCryptoPassword";
import IniCrypto from "@/components/InitCrypto";

const rowStyle: CSSProperties = {
  minHeight: 56,
  padding: "0 16px",
};

const rowBorderStyle: CSSProperties = {
  borderBottom: "1px solid var(--gray-a5)",
};

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
      <Flex align="center" justify="between" style={rowStyle}>
        <Text size="2">Crypto Enable</Text>
        <Switch checked={cryptoEnable} onCheckedChange={onCryptoEnableChange} />
      </Flex>
      {cryptoEnable && (
        <Flex
          align="center"
          justify="between"
          style={{ ...rowStyle, ...rowBorderStyle }}
        >
          <Text size="2">Change Crypto Password</Text>
          <Button
            type="button"
            variant="ghost"
            color="gray"
            onClick={onChangeCryptoPassword}
          >
            <ArrowRightIcon />
          </Button>
        </Flex>
      )}
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
