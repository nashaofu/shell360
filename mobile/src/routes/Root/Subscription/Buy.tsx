import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Avatar,
  Link,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import {
  IapOffering,
  IapPackageType,
  iapPurchasePackage,
  iapRestore,
  IapSubscriptionPeriodUnit,
} from 'tauri-plugin-mobile';

import { useRefreshCustomerInfoAtom } from '@/atom/iap';
import useMessage from '@/hooks/useMessage';
import openUrl from '@/utils/openUrl';

import logo from './logo.svg';

type BuyProps = {
  offerings: IapOffering[];
  onLoadingChange: (loading: boolean) => unknown;
};

const subscriptionPeriodUnit = {
  [IapSubscriptionPeriodUnit.Day]: 'day',
  [IapSubscriptionPeriodUnit.Month]: 'month',
  [IapSubscriptionPeriodUnit.Week]: 'week',
  [IapSubscriptionPeriodUnit.Year]: 'year',
};

const packageType: Record<number, string> = {
  [IapPackageType.Annual]: 'Annual',
  [IapPackageType.SixMonth]: 'Six Month',
  [IapPackageType.ThreeMonth]: 'Three Month',
  [IapPackageType.TwoMonth]: 'Two Month',
  [IapPackageType.Monthly]: 'Monthly',
  [IapPackageType.Weekly]: 'Weekly',
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
    [offerings]
  );

  const defaultOfferingAvailablePackages = useMemo(
    () => offeringsMap.get('default')?.availablePackages ?? [],
    [offeringsMap]
  );

  const onBuyPackage = useCallback(async () => {
    const selectedPackage = defaultOfferingAvailablePackages.find(
      (item) => item.identifier === selectedPackageIdentifier
    );

    if (!selectedPackage) {
      message.info({
        message: 'Please select the subscription period.',
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
        message: 'Subscription Failed, Please Try Again',
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
      <Box
        sx={{
          textAlign: 'center',
        }}
      >
        <Avatar
          src={logo}
          variant="rounded"
          sx={{
            width: 128,
            height: 128,
            mr: 'auto',
            mb: 1.5,
            ml: 'auto',
          }}
        />
        <Typography variant="h5">Shell360</Typography>
        <Box
          sx={{
            textAlign: 'center',
            gap: '0 4px',
          }}
        >
          <Link
            sx={{
              marginRight: 0.5,
            }}
            onClick={() =>
              openUrl('https://shell360.github.io/release/Privacy-Policy.html')
            }
          >
            Privacy Policy
          </Link>
          <Link
            sx={{
              marginLeft: 0.5,
            }}
            onClick={() =>
              openUrl('http://www.apple.com/legal/itunes/appstore/dev/stdeula')
            }
          >
            Terms of Use
          </Link>
        </Box>
        <Typography
          variant="subtitle1"
          sx={{
            textAlign: 'left',
            mt: 2,
          }}
        >
          Subscribe to unlock the following features
        </Typography>
        <Box
          component="ol"
          sx={{
            textAlign: 'left',
            pt: 0,
            pr: 0,
            pb: 0,
            pl: 3,
            mt: 0.5,
            mr: 0,
            mb: 0,
            ml: 0,
          }}
        >
          <Typography variant="body2" component="li">
            Unlimited creation of hosts(Default: 3 host)
          </Typography>
          <Typography
            variant="body2"
            component="li"
            sx={{
              mt: 0.5,
            }}
          >
            Unlimited creation of keys(Default: 1 key)
          </Typography>
          <Typography
            variant="body2"
            component="li"
            sx={{
              mt: 0.5,
            }}
          >
            Enable import of application configuration
          </Typography>
          <Typography
            variant="body2"
            component="li"
            sx={{
              mt: 0.5,
            }}
          >
            Enable export of application configuration
          </Typography>
        </Box>
      </Box>
      <List sx={{ mt: 1 }}>
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
          const periodUnitText = periodUnit ? `/${periodUnit}` : '';
          let desc = `Full features for just ${price}${periodUnitText}`;

          const subscriptionPeriod =
            storeProduct.introductoryDiscount?.subscriptionPeriod;
          if (subscriptionPeriod) {
            const introductoryDiscountPeriodUnit =
              subscriptionPeriodUnit[subscriptionPeriod.unit];

            desc = `First ${subscriptionPeriod.value} ${introductoryDiscountPeriodUnit} free, then ${price}${periodUnitText}`;
          }

          return (
            <ListItem key={item.identifier} disablePadding>
              <ListItemButton
                onClick={() => setSelectedPackageIdentifier(item.identifier)}
                selected={selectedPackageIdentifier === item.identifier}
                divider
              >
                <ListItemIcon
                  sx={{
                    minWidth: 'unset',
                  }}
                >
                  <Checkbox
                    edge="start"
                    tabIndex={-1}
                    disableRipple
                    checked={selectedPackageIdentifier === item.identifier}
                  />
                </ListItemIcon>
                <ListItemText primary={period} secondary={desc} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ mt: 3 }}>
        <Button
          variant="contained"
          fullWidth
          color="success"
          size="large"
          onClick={onBuyPackage}
        >
          Continue
        </Button>
        <Button
          sx={{ mt: 2 }}
          variant="contained"
          fullWidth
          color="info"
          size="large"
          onClick={onRestore}
        >
          Restore
        </Button>
      </Box>
    </>
  );
}
