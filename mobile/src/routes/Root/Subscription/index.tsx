import dayjs from "dayjs";
import { get } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { Loading } from "shared";

import {
  useIsShowPaywallAtom,
  useIsSubscription,
  useLoadableCustomerInfoAtom,
  useLoadableOfferingsAtomValue,
} from "@/atom/iap";

import Buy from "./Buy";

export default function Subscription() {
  const isSubscription = useIsSubscription();
  const [open, setOpen] = useIsShowPaywallAtom();
  const loadableOfferingsAtomValue = useLoadableOfferingsAtomValue();
  const [loadableCustomerInfoAtom] = useLoadableCustomerInfoAtom();
  const [buyLoading, setBuyLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  const customerInfo = useMemo(() => {
    if (loadableCustomerInfoAtom.state === "hasData") {
      return loadableCustomerInfoAtom.data;
    }

    return undefined;
  }, [loadableCustomerInfoAtom]);

  const expiredTime = useMemo(() => {
    if (!isSubscription) {
      return undefined;
    }

    if (!customerInfo) {
      return undefined;
    }

    const expirationDate = get(
      customerInfo,
      "entitlements.all.premium.expirationDate",
    );

    if (typeof expirationDate !== "number") {
      return undefined;
    }

    return dayjs.unix(expirationDate).format("YYYY-MM-DD HH:mm");
  }, [isSubscription, customerInfo]);

  useEffect(() => {
    const onResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return open ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: windowWidth < 580 ? "stretch" : "center",
        justifyContent: "center",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div
        style={{
          width: windowWidth < 580 ? "100%" : "min(680px, 92vw)",
          height: windowWidth < 580 ? "100%" : "auto",
          maxHeight: windowWidth < 580 ? "100%" : "90vh",
          overflow: "auto",
          background: "var(--color-panel-solid)",
          color: "var(--gray-12)",
          borderRadius: windowWidth < 580 ? 0 : 12,
        }}
      >
        <div
          style={{
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            borderBottom: "1px solid var(--gray-a6)",
          }}
        >
          <div style={{ flex: 1, fontSize: 20, fontWeight: 600 }}>
            Subscription
          </div>
          <button
            type="button"
            disabled={
              loadableOfferingsAtomValue.state === "loading" || buyLoading
            }
            onClick={() => setOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <span className="icon-close" />
          </button>
        </div>
        <div style={{ padding: 16 }}>
          <Loading
            loading={
              loadableOfferingsAtomValue.state === "loading" || buyLoading
            }
            size={32}
          >
            {isSubscription && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--green-a3)",
                  color: "var(--green-11)",
                }}
              >
                Your subscription is about to expire in {expiredTime}
              </div>
            )}

            <div
              style={{
                maxWidth: 420,
                margin: "0 auto",
                padding: "16px 0 24px",
                textAlign: "center",
              }}
            >
              {loadableOfferingsAtomValue.state === "loading" && (
                <div style={{ padding: 32 }}>Loading...</div>
              )}
              {loadableOfferingsAtomValue.state === "hasError" && (
                <div style={{ textAlign: "center" }}>
                  <span
                    className="icon-error-circle"
                    style={{ fontSize: 48, color: "var(--red-9)" }}
                  />
                  <div>Loading failed</div>
                </div>
              )}
              {loadableOfferingsAtomValue.state === "hasData" && (
                <Buy
                  offerings={loadableOfferingsAtomValue.data}
                  onLoadingChange={setBuyLoading}
                />
              )}
            </div>
          </Loading>
        </div>
      </div>
    </div>
  ) : null;
}
