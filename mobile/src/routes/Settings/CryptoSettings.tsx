import { useAtomValue } from "jotai";
import { type ChangeEvent, useCallback, useState } from "react";
import { changeCryptoEnable } from "tauri-plugin-data";
import { cryptoIsEnableAtom } from "@/atom/cryptoAtom";
import ChangeCryptoPassword from "@/components/ChangeCryptoPassword";
import IniCrypto from "@/components/InitCrypto";

export default function CryptoSettings() {
  const cryptoEnable = useAtomValue(cryptoIsEnableAtom);

  const [initCryptoIsOpen, setInitCryptoIsOpen] = useState(false);

  const onCryptoEnableChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        setInitCryptoIsOpen(true);
      } else {
        changeCryptoEnable({
          cryptoEnable: false,
        });
      }
    },
    [],
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
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        <li
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
            borderBottom: "1px solid var(--gray-a5)",
          }}
        >
          <span>Crypto Enable</span>
          <input
            type="checkbox"
            checked={cryptoEnable}
            onChange={onCryptoEnableChange}
          />
        </li>
        {cryptoEnable && (
          <li
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 56,
              padding: "0 16px",
            }}
          >
            <span>Change Crypto Password</span>
            <button
              type="button"
              onClick={onChangeCryptoPassword}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <span className="icon-arrow-right" />
            </button>
          </li>
        )}
      </ul>
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
