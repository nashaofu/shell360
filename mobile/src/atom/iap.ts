import { useCallback, useMemo } from 'react';
import {
  atom, useAtom, useAtomValue, useSetAtom,
} from 'jotai';
import { atomWithRefresh, loadable } from 'jotai/utils';
import {
  IapCustomerInfo,
  iapGetCustomerInfo,
  iapGetOfferings,
  IapOffering,
  iapShowPaywall,
} from 'tauri-plugin-mobile';
import { get } from 'lodash-es';
import dayjs from 'dayjs';

const IAP_CUSTOMER_INFO = 'iap-customer-info';

const iapGetCustomerInfoWithMock = () => {
  if (__TAURI_PLATFORM__ === 'android') {
    return Promise.resolve({
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: [],
      entitlements: {
        all: {
          premium: {
            identifier: '$rc_annual',
            isActive: true,
            willRenew: true,
            periodType: {
              // 假设的周期类型枚举值
              value: 'MONTHLY',
            },
            latestPurchaseDate: Date.now(), // 使用当前时间的时间戳
            originalPurchaseDate: Date.now() - 1000 * 60 * 60 * 24 * 30, // 假设是30天前
            expirationDate: null, // 假设没有到期日期
            store: {
              // 假设的商店信息
              name: 'App Store',
              platform: 'iOS',
            },
            productIdentifier: '$rc_annual',
            productPlanIdentifier: null, // 假设没有产品计划标识符
            isSandbox: false,
            unsubscribeDetectedAt: null, // 假设没有检测到取消订阅
            billingIssueDetectedAt: null, // 假设没有检测到账单问题
            ownershipType: {
              // 假设的所有权类型枚举值
              value: 'PURCHASED',
            },
            verification: {
              // 假设的验证信息
              status: 'VERIFIED',
              receipt: 'mock_receipt_data',
            },
          },
        },
        verification: 0,
      },
      firstSeen: 1722665474,
      nonSubscriptions: [],
      originalAppUserId: '$RCAnonymousID:6b909d61e0f641279b8a41726bb7659f',
      requestDate: 1722780249,
    } as unknown as IapCustomerInfo);
  }
  return iapGetCustomerInfo();
};

const iapGetOfferingsWithMock = async () => {
  if (__TAURI_PLATFORM__ === 'android') {
    return Promise.resolve([
      {
        annual: {
          identifier: '$rc_annual',
          packageType: 1,
          storeProduct: {
            currencyCode: 'USD',
            discounts: [],
            isFamilyShareable: true,
            localizedDescription: 'Get one year of premium benefits',
            localizedPriceString: '$19.99',
            localizedTitle: '1 year',
            price: 19.989999999999995,
            productCategory: 0,
            productIdentifier: 'annual_payment',
            productType: 3,
            subscriptionGroupIdentifier: '21495632',
            subscriptionPeriod: {
              unit: 3,
              value: 1,
            },
          },
        },
        availablePackages: [
          {
            identifier: '$rc_monthly',
            packageType: 5,
            storeProduct: {
              currencyCode: 'USD',
              discounts: [],
              isFamilyShareable: true,
              localizedDescription: 'Get one month of premium benefits',
              localizedPriceString: '$1.99',
              localizedTitle: '1 month',
              price: 1.99,
              productCategory: 0,
              productIdentifier: 'monthly_payment',
              productType: 3,
              subscriptionGroupIdentifier: '21495632',
              subscriptionPeriod: {
                unit: 2,
                value: 1,
              },
            },
          },
          {
            identifier: '$rc_annual',
            packageType: 1,
            storeProduct: {
              currencyCode: 'USD',
              discounts: [],
              isFamilyShareable: true,
              localizedDescription: 'Get one year of premium benefits',
              localizedPriceString: '$19.99',
              localizedTitle: '1 year',
              price: 19.989999999999995,
              productCategory: 0,
              productIdentifier: 'annual_payment',
              productType: 3,
              subscriptionGroupIdentifier: '21495632',
              subscriptionPeriod: {
                unit: 3,
                value: 1,
              },
            },
          },
        ],
        identifier: 'default',
        monthly: {
          identifier: '$rc_monthly',
          packageType: 5,
          storeProduct: {
            currencyCode: 'USD',
            discounts: [],
            isFamilyShareable: true,
            localizedDescription: 'Get one month of premium benefits',
            localizedPriceString: '$1.99',
            localizedTitle: '1 month',
            price: 1.99,
            productCategory: 0,
            productIdentifier: 'monthly_payment',
            productType: 3,
            subscriptionGroupIdentifier: '21495632',
            subscriptionPeriod: {
              unit: 2,
              value: 1,
            },
          },
        },
        serverDescription: 'The standard set of packages',
      },
    ] as unknown as IapOffering[]);
  }

  return iapGetOfferings();
};

const customerInfoAtom = atomWithRefresh(async () => {
  const customerInfo = await iapGetCustomerInfoWithMock();
  localStorage.setItem(IAP_CUSTOMER_INFO, JSON.stringify(customerInfo));
  return customerInfo;
});

const offeringsAtom = atom(() => iapGetOfferingsWithMock());

const isShowPaywallAtom = atom(false);

export function useLoadableCustomerInfoAtom() {
  return useAtom(loadable(customerInfoAtom));
}

export function useRefreshCustomerInfoAtom() {
  return useSetAtom(customerInfoAtom);
}

export function useIsSubscription() {
  const [state] = useLoadableCustomerInfoAtom();

  const isSubscription = useMemo(() => {
    if (state.state === 'loading') {
      return undefined;
    }

    if (state.state === 'hasError') {
      try {
        const json = localStorage.getItem(IAP_CUSTOMER_INFO);
        if (!json) {
          return false;
        }
        const customerInfo = JSON.parse(json) as IapCustomerInfo;
        const premium = get(customerInfo, 'entitlements.all.premium');
        if (!premium) {
          return false;
        }

        const expirationDate = get(premium, 'expirationDate');
        if (typeof expirationDate !== 'number') {
          return false;
        }

        // 过期 7 天内还可使用
        if (dayjs.unix(expirationDate).add(7, 'day').isAfter(dayjs())) {
          return premium?.isActive ?? false;
        }

        return false;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        return undefined;
      }
    }

    return get(state.data, 'entitlements.all.premium.isActive', false);
  }, [state]);

  return isSubscription;
}

export function useLoadableOfferingsAtomValue() {
  return useAtomValue(loadable(offeringsAtom));
}

export function useIsShowPaywallAtom() {
  const [isShow, setIsShow] = useAtom(isShowPaywallAtom);
  const refreshCustomerInfoAtom = useRefreshCustomerInfoAtom();

  const setShowPaywall = useCallback(
    async (val: boolean) => {
      if (val) {
        // 如果显示了原生 paywall，则不显示 web 端订阅界面
        const isShowIapShowPaywall = await iapShowPaywall();
        if (!isShowIapShowPaywall) {
          setIsShow(true);
        } else {
          refreshCustomerInfoAtom();
        }
      } else {
        setIsShow(false);
      }
    },
    [refreshCustomerInfoAtom, setIsShow],
  );

  return [isShow, setShowPaywall] as const;
}
