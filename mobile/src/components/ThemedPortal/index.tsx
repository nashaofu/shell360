import { Portal, Theme } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useAppearanceValue } from "shared";

type ThemedPortalProps = {
  children: ReactNode;
};

export default function ThemedPortal({ children }: ThemedPortalProps) {
  const appearance = useAppearanceValue();

  return (
    <Portal>
      <Theme
        appearance={appearance}
        accentColor="green"
        grayColor="gray"
        panelBackground="translucent"
        radius="medium"
        scaling="100%"
      >
        {children}
      </Theme>
    </Portal>
  );
}
