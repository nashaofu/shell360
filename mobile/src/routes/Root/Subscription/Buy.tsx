import { Button } from "@radix-ui/themes";
import { useCallback, useMemo, useState } from "react";
import {
  type IapOffering,
  IapPackageType,
  IapSubscriptionPeriodUnit,
  iapPurchasePackage,
  iapRestore,
} from "tauri-plugin-mobile";

import { useRefreshCustomerInfoAtom } from "@/atom/iap";
import useMessage from "@/hooks/useMessage";
import openUrl from "@/utils/openUrl";

import logo from "./logo.svg";

type BuyProps = {
  offerings: IapOffering[];
  onLoadingChange: (loading: boolean) => unknown;
};

const subscriptionPeriodUnit = {
  [IapSubscriptionPeriodUnit.Day]: "day",
  [IapSubscriptionPeriodUnit.Month]: "month",
  [IapSubscriptionPeriodUnit.Week]: "week",
  [IapSubscriptionPeriodUnit.Year]: "year",
};

const packageType: Record<number, string> = {
  [IapPackageType.Annual]: "Annual",
  [IapPackageType.SixMonth]: "Six Month",
  [IapPackageType.ThreeMonth]: "Three Month",
  [IapPackageType.TwoMonth]: "Two Month",
  [IapPackageType.Monthly]: "Monthly",
  [IapPackageType.Weekly]: "Weekly",
};

export default function Buy({ offerings, onLoadingChange }: BuyProps) {
  const refreshCustomerInfoAtom = useRefreshCustomerInfoAtom();
  const message = useMessage();
  const [selectedPackageIdentifier, setSelectedPackageIdentifier] =
    useState<string>();

  const offeringsMap = useMemo(
    () =>
      offerings.reduce((map, item) => {
        map.set(item.identifier, item);
        return map;
      }, new Map<string, IapOffering>()),
    [offerings],
  );

  const defaultOfferingAvailablePackages = useMemo(
    () => offeringsMap.get("default")?.availablePackages ?? [],
    [offeringsMap],
  );

  const onBuyPackage = useCallback(async () => {
    const selectedPackage = defaultOfferingAvailablePackages.find(
      (item) => item.identifier === selectedPackageIdentifier,
    );

    if (!selectedPackage) {
      message.info({
        message: "Please select the subscription period.",
      });
      return;
    }

    onLoadingChange(true);

    try {
      await iapPurchasePackage({
        packageIdentifier: selectedPackage.identifier,
      });
    } catch (err) {
      message.error({
        message: "Subscription Failed, Please Try Again",
      });
      if (err instanceof Error) {
        throw err;
      } else {
        throw new Error(JSON.stringify(err));
      }
    } finally {
      refreshCustomerInfoAtom();
      onLoadingChange(false);
    }
  }, [
    defaultOfferingAvailablePackages,
    onLoadingChange,
    selectedPackageIdentifier,
    message,
    refreshCustomerInfoAtom,
  ]);

  const onRestore = useCallback(async () => {
    try {
      onLoadingChange(true);
      await iapRestore();
    } finally {
      refreshCustomerInfoAtom();
      onLoadingChange(false);
    }
  }, [onLoadingChange, refreshCustomerInfoAtom]);

  return (
    <>
      <div style={{ textAlign: "center" }}>
        <img
          src={logo}
          alt="Shell360"
          style={{
            width: 128,
            height: 128,
            margin: "0 auto 12px",
            borderRadius: 16,
          }}
        />
        <h2 style={{ margin: 0 }}>Shell360</h2>
        <div
          style={{
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-10)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() =>
              openUrl(
                "https://nashaofu.github.io/shell360/docs/Privacy-Policy.html",
              )
            }
          >
            Privacy Policy
          </button>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-10)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() =>
              openUrl("http://www.apple.com/legal/itunes/appstore/dev/stdeula")
            }
          >
            Terms of Use
          </button>
        </div>
        <div
          style={{
            textAlign: "left",
            marginTop: 16,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          Subscribe to unlock the following features
        </div>
        <ol
          style={{
            textAlign: "left",
            padding: "0 0 0 24px",
            margin: "8px 0 0",
          }}
        >
          <li style={{ fontSize: 14 }}>
            Unlimited creation of hosts(Default: 3 host)
          </li>
          <li style={{ fontSize: 14, marginTop: 4 }}>
            Unlimited creation of keys(Default: 1 key)
          </li>
          <li style={{ fontSize: 14, marginTop: 4 }}>
            Enable import of application configuration
          </li>
          <li style={{ fontSize: 14, marginTop: 4 }}>
            Enable export of application configuration
          </li>
        </ol>
      </div>
      <div style={{ marginTop: 12 }}>
        {defaultOfferingAvailablePackages.map((item) => {
          const { storeProduct } = item;
          const price = storeProduct.localizedPriceString;
          const period =
            packageType[item.packageType as number] ??
            storeProduct.localizedTitle;
          const periodUnit =
            subscriptionPeriodUnit[
              storeProduct.subscriptionPeriod?.unit as IapSubscriptionPeriodUnit
            ];
          const periodUnitText = periodUnit ? `/${periodUnit}` : "";
          let desc = `Full features for just ${price}${periodUnitText}`;

          const subscriptionPeriod =
            storeProduct.introductoryDiscount?.subscriptionPeriod;
          if (subscriptionPeriod) {
            const introductoryDiscountPeriodUnit =
              subscriptionPeriodUnit[subscriptionPeriod.unit];

            desc = `First ${subscriptionPeriod.value} ${introductoryDiscountPeriodUnit} free, then ${price}${periodUnitText}`;
          }

          return (
            <button
              type="button"
              key={item.identifier}
              onClick={() => setSelectedPackageIdentifier(item.identifier)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "1px solid var(--gray-a6)",
                borderRadius: "var(--radius-3)",
                marginTop: 8,
                padding: 12,
                background:
                  selectedPackageIdentifier === item.identifier
                    ? "var(--accent-a3)"
                    : "var(--color-panel-solid)",
                cursor: "pointer",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="radio"
                  checked={selectedPackageIdentifier === item.identifier}
                  readOnly
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{period}</div>
                  <div style={{ fontSize: 13, color: "var(--gray-11)" }}>
                    {desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <Button
          style={{ width: "100%", height: 44 }}
          color="green"
          onClick={onBuyPackage}
        >
          Continue
        </Button>
        <Button
          style={{ width: "100%", height: 44, marginTop: 12 }}
          color="blue"
          onClick={onRestore}
        >
          Restore
        </Button>
      </div>
    </>
  );
}
