import {
  Alert,
  AppBar,
  Box,
  Dialog,
  DialogContent,
  Icon,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
  Slide,
  DialogProps,
} from '@mui/material';
import {
  ReactElement,
  Ref,
  forwardRef,
  useEffect,
  useMemo,
  useState,
} from 'react';
import dayjs from 'dayjs';
import { get } from 'lodash-es';
import { useAtomValue } from 'jotai';
import { Loading } from 'shared';

import {
  useIsShowPaywallAtom,
  useIsSubscription,
  useLoadableOfferingsAtomValue,
  useLoadableCustomerInfoAtom,
} from '@/atom/iap';
import { themeAtom } from '@/atom/themeAtom';

import Buy from './Buy';

const Transition = forwardRef(
  (
    props: DialogProps['TransitionProps'] & {
      children: ReactElement;
    },
    ref: Ref<unknown>
  ) => <Slide direction="up" ref={ref} {...props} />
);

export default function Subscription() {
  const theme = useAtomValue(themeAtom);
  const isSubscription = useIsSubscription();
  const [open, setOpen] = useIsShowPaywallAtom();
  const loadableOfferingsAtomValue = useLoadableOfferingsAtomValue();
  const [loadableCustomerInfoAtom] = useLoadableCustomerInfoAtom();
  const [buyLoading, setBuyLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  const customerInfo = useMemo(() => {
    if (loadableCustomerInfoAtom.state === 'hasData') {
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
      'entitlements.all.premium.expirationDate'
    );

    if (typeof expirationDate !== 'number') {
      return undefined;
    }

    return dayjs.unix(expirationDate).format('YYYY-MM-DD HH:mm');
  }, [isSubscription, customerInfo]);

  useEffect(() => {
    const onResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        open={open}
        fullWidth
        fullScreen={windowWidth < 580}
        TransitionComponent={Transition}
        sx={{
          '.MuiDialog-container': {
            paddingTop: 'env(safe-area-inset-top)',
          },
        }}
      >
        <AppBar position="static">
          <Toolbar>
            <Typography
              sx={{
                flex: 1,
              }}
              variant="h6"
            >
              Subscription
            </Typography>
            <IconButton
              size="large"
              edge="end"
              sx={{
                color: 'inherit',
                ml: 2,
              }}
              disabled={
                loadableOfferingsAtomValue.state === 'loading' || buyLoading
              }
              onClick={() => setOpen(false)}
            >
              <Icon className="icon-close" />
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent>
          <Loading
            loading={
              loadableOfferingsAtomValue.state === 'loading' || buyLoading
            }
            size={32}
          >
            {isSubscription && (
              <Alert severity="success">
                Your subscription is about to expire in {expiredTime}
              </Alert>
            )}

            <Box
              sx={{
                maxWidth: 420,
                mr: 'auto',
                ml: 'auto',
                pt: 2,
                pb: 3,
                textAlign: 'center',
              }}
            >
              {loadableOfferingsAtomValue.state === 'loading' && (
                <Box
                  sx={{
                    p: 4,
                  }}
                >
                  Loading...
                </Box>
              )}
              {loadableOfferingsAtomValue.state === 'hasError' && (
                <Box
                  sx={{
                    textAlign: 'center',
                  }}
                >
                  <Icon
                    sx={{
                      fontSize: (theme) => theme.typography.h1.fontSize,
                      color: (theme) => theme.palette.error.light,
                    }}
                    className="icon-error-circle"
                  />
                  <Typography>Loading failed</Typography>
                </Box>
              )}
              {loadableOfferingsAtomValue.state === 'hasData' && (
                <Buy
                  offerings={loadableOfferingsAtomValue.data}
                  onLoadingChange={setBuyLoading}
                />
              )}
            </Box>
          </Loading>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}
