import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

export type Theme = any;
export type SxProps<T = Theme> = T extends Theme ? any : any;
export type ButtonProps = any;
export type DialogContentProps = any;
export type DialogProps = any;

const defaultTheme: any = {
  palette: {
    mode: "light",
    primary: { main: "#3b82f6" },
    error: { main: "#dc2626" },
    success: { main: "#16a34a", contrastText: "#ffffff" },
    background: { default: "#f8fafc", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#475569" },
    divider: "#e2e8f0",
    getContrastText: () => "#ffffff",
    augmentColor: ({ color }: any) => ({ main: color.main }),
  },
  spacing: (value: number) => `${value * 8}px`,
};

const ThemeContext = createContext<any>(defaultTheme);

function mergeTheme(base: any, partial?: any): any {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    palette: {
      ...base.palette,
      ...(partial.palette || {}),
      primary: { ...base.palette.primary, ...(partial.palette?.primary || {}) },
      error: { ...base.palette.error, ...(partial.palette?.error || {}) },
      success: { ...base.palette.success, ...(partial.palette?.success || {}) },
      background: {
        ...base.palette.background,
        ...(partial.palette?.background || {}),
      },
      text: { ...base.palette.text, ...(partial.palette?.text || {}) },
    },
  };
}

function space(theme: any, value: any) {
  if (typeof value === "number") return theme.spacing(value);
  return value;
}

function expandShorthand(style: any, theme: any) {
  const next = { ...(style || {}) };
  const map: Record<string, string[]> = {
    m: ["margin"],
    mt: ["marginTop"],
    mr: ["marginRight"],
    mb: ["marginBottom"],
    ml: ["marginLeft"],
    mx: ["marginLeft", "marginRight"],
    my: ["marginTop", "marginBottom"],
    p: ["padding"],
    pt: ["paddingTop"],
    pr: ["paddingRight"],
    pb: ["paddingBottom"],
    pl: ["paddingLeft"],
    px: ["paddingLeft", "paddingRight"],
    py: ["paddingTop", "paddingBottom"],
  };

  for (const [key, cssKeys] of Object.entries(map)) {
    if (key in next) {
      const value = space(theme, next[key]);
      delete next[key];
      for (const cssKey of cssKeys) next[cssKey] = value;
    }
  }

  return next;
}

function toStyle(sx: any, theme: any): any {
  if (!sx) return {};
  if (Array.isArray(sx))
    return sx.reduce((acc, item) => ({ ...acc, ...toStyle(item, theme) }), {});
  if (typeof sx === "function") return expandShorthand(sx(theme), theme);
  return expandShorthand(sx, theme);
}

export function Box(props: any) {
  const { component, sx, style, ...rest } = props;
  const Comp = component || "div";
  const theme = useContext(ThemeContext);
  return <Comp {...rest} style={{ ...toStyle(sx, theme), ...style }} />;
}

export function Typography(props: any) {
  const { component = "p", ...rest } = props;
  return <Box component={component} {...rest} />;
}

export function Button(props: any) {
  const {
    sx,
    style,
    type = "button",
    startIcon,
    endIcon,
    children,
    fullWidth,
    ...rest
  } = props;
  const theme = useContext(ThemeContext);
  return (
    <button
      {...rest}
      type={type}
      style={{
        width: fullWidth ? "100%" : undefined,
        ...toStyle(sx, theme),
        ...style,
      }}
    >
      {startIcon}
      {children}
      {endIcon}
    </button>
  );
}

export function ButtonGroup(props: any) {
  const { sx, style, ...rest } = props;
  const theme = useContext(ThemeContext);
  return (
    <div
      {...rest}
      style={{
        display: "inline-flex",
        gap: 8,
        ...toStyle(sx, theme),
        ...style,
      }}
    />
  );
}

export function Icon(props: any) {
  const { sx, style, children, className, ...rest } = props;
  const theme = useContext(ThemeContext);
  return (
    <span
      {...rest}
      className={`material-symbols-outlined ${className || ""}`.trim()}
      style={{ ...toStyle(sx, theme), ...style }}
    >
      {children}
    </span>
  );
}

export function IconButton(props: any) {
  return <Button {...props} />;
}

export function Avatar(props: any) {
  return <Box {...props} component="div" />;
}

export function CircularProgress(props: any) {
  const { sx, style, size = 18 } = props;
  const theme = useContext(ThemeContext);
  return (
    <span
      aria-label="loading"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "9999px",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        animation: "mui-compat-spin 0.8s linear infinite",
        ...toStyle(sx, theme),
        ...style,
      }}
    />
  );
}

export function LinearProgress(props: any) {
  const { value = 0, valueBuffer, sx, style } = props;
  const theme = useContext(ThemeContext);
  const primary = Math.max(0, Math.min(100, value));
  const buffer = Math.max(primary, Math.min(100, valueBuffer ?? value));
  return (
    <div
      style={{
        position: "relative",
        height: 6,
        background: "var(--gray-a5)",
        borderRadius: 999,
        overflow: "hidden",
        ...toStyle(sx, theme),
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${buffer}%`,
          background: "var(--gray-a8)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${primary}%`,
          background: "var(--accent-9)",
        }}
      />
    </div>
  );
}

export function Grid(props: any) {
  const { sx, style, container, item, xs, size, spacing, ...rest } = props;
  const theme = useContext(ThemeContext);
  const widthVal = typeof size === "number" ? size : xs;
  const layout: any = {};
  if (container) {
    layout.display = "flex";
    layout.flexWrap = "wrap";
    if (typeof spacing === "number") layout.gap = theme.spacing(spacing / 2);
  }
  if (item || typeof widthVal === "number") {
    const w = ((widthVal || 12) / 12) * 100;
    layout.flex = `0 0 ${w}%`;
    layout.maxWidth = `${w}%`;
  }
  return (
    <div {...rest} style={{ ...layout, ...toStyle(sx, theme), ...style }} />
  );
}

export function Dialog(props: any) {
  const {
    open,
    onClose,
    children,
    fullScreen,
    keepMounted,
    PaperProps,
    sx,
    style,
  } = props;
  if (!open && !keepMounted) return null;
  return createPortal(
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget)
          onClose?.(event, "backdropClick");
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: open ? "flex" : "none",
        alignItems: fullScreen ? "stretch" : "center",
        justifyContent: "center",
        backgroundColor: "rgba(2,6,23,0.45)",
        ...toStyle(sx, defaultTheme),
        ...style,
      }}
    >
      <div
        className={PaperProps?.className}
        style={{
          width: fullScreen ? "100vw" : "min(92vw, 720px)",
          height: fullScreen ? "100vh" : "auto",
          background: "var(--color-panel-solid, #fff)",
          borderRadius: fullScreen ? 0 : 12,
          overflow: "auto",
          ...(PaperProps?.style || {}),
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogTitle(props: any) {
  return (
    <Box
      {...props}
      component="div"
      style={{ padding: "16px 20px", ...(props.style || {}) }}
    />
  );
}
export function DialogContent(props: any) {
  return (
    <Box
      {...props}
      component="div"
      style={{ padding: "0 20px 16px", ...(props.style || {}) }}
    />
  );
}
export function DialogContentText(props: any) {
  return <Box {...props} component="div" />;
}
export function DialogActions(props: any) {
  return (
    <Box
      {...props}
      component="div"
      style={{
        padding: "12px 20px 20px",
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        ...(props.style || {}),
      }}
    />
  );
}

export function Drawer(props: any) {
  const { open = false, onClose, children } = props;
  if (!open) return null;
  return createPortal(
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        backgroundColor: "rgba(2, 6, 23, 0.45)",
      }}
    >
      <div
        style={{
          width: 320,
          maxWidth: "88vw",
          height: "100%",
          backgroundColor: "#fff",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SwipeableDrawer(props: any) {
  return <Drawer {...props} />;
}
export function AppBar(props: any) {
  return <Box {...props} component="div" />;
}
export function Toolbar(props: any) {
  return <Box {...props} component="div" />;
}
export function Paper(props: any) {
  return <Box {...props} component="div" />;
}
export function Divider(props: any) {
  return (
    <hr
      {...props}
      style={{
        border: 0,
        borderTop: "1px solid var(--gray-a6)",
        ...(props.style || {}),
      }}
    />
  );
}

export function List(props: any) {
  const { component, sx, style, ...rest } = props;
  const Comp = component || "ul";
  const theme = useContext(ThemeContext);
  return (
    <Comp
      {...rest}
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        ...toStyle(sx, theme),
        ...style,
      }}
    />
  );
}

export function ListItem(props: any) {
  return <Box {...props} component="li" />;
}
export function ListItemButton(props: any) {
  return (
    <Button
      {...props}
      style={{ width: "100%", textAlign: "left", ...(props.style || {}) }}
    />
  );
}
export function ListItemIcon(props: any) {
  return (
    <Box
      {...props}
      component="span"
      style={{ display: "inline-flex", ...(props.style || {}) }}
    />
  );
}

export function ListItemText(props: any) {
  const { primary, secondary, children, ...rest } = props;
  if (children !== undefined) {
    return <span {...rest}>{children}</span>;
  }
  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        ...(rest.style || {}),
      }}
    >
      <span>{primary}</span>
      {secondary ? <span>{secondary}</span> : null}
    </span>
  );
}

export function Menu(props: any) {
  const { open, onClose, children, anchorPosition } = props;
  if (!open) return null;
  return createPortal(
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 1500 }}
    >
      <div
        style={{
          position: "fixed",
          top: anchorPosition?.top ?? 16,
          left: anchorPosition?.left ?? 16,
          minWidth: 180,
          background: "var(--color-panel-solid, #fff)",
          border: "1px solid var(--gray-a6)",
          borderRadius: 10,
          padding: 6,
          boxShadow: "0 12px 30px rgba(15,23,42,0.2)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function MenuItem(props: any) {
  return <Button {...props} />;
}
export function OutlinedInput(props: any) {
  return (
    <input
      {...props}
      style={{
        border: "1px solid var(--gray-a7)",
        borderRadius: 8,
        padding: "8px 10px",
        ...(props.style || {}),
      }}
    />
  );
}
export function FormControl(props: any) {
  return <Box {...props} component="div" />;
}
export function InputLabel(props: any) {
  return <label {...props} />;
}
export function Select(props: any) {
  return (
    <select
      {...props}
      style={{
        border: "1px solid var(--gray-a7)",
        borderRadius: 8,
        padding: "8px 10px",
        ...(props.style || {}),
      }}
    />
  );
}
export function TextField(props: any) {
  return <OutlinedInput {...props} />;
}
export function InputAdornment(props: any) {
  return <span {...props} />;
}
export function FormControlLabel(props: any) {
  const { control, label, ...rest } = props;
  return (
    <label
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...(rest.style || {}),
      }}
    >
      {control}
      <span>{label}</span>
    </label>
  );
}
export function Switch(props: any) {
  return <input {...props} type="checkbox" />;
}
export function Checkbox(props: any) {
  return <input {...props} type="checkbox" />;
}
export function ToggleButtonGroup(props: any) {
  return (
    <Box
      {...props}
      component="div"
      style={{ display: "inline-flex", gap: 8, ...(props.style || {}) }}
    />
  );
}
export function ToggleButton(props: any) {
  return <Button {...props} />;
}
export function Tabs(props: any) {
  return <Box {...props} component="div" />;
}
export function Tab(props: any) {
  return <Button {...props} />;
}
export function Tooltip(props: any) {
  const { title, children } = props;
  return (
    <span title={typeof title === "string" ? title : undefined}>
      {children}
    </span>
  );
}
export function Link(props: any) {
  return <a {...props}>{props.children}</a>;
}
export function Alert(props: any) {
  return <Box {...props} component="div" />;
}
export function Slide(props: any) {
  const { children, in: inProp = true, mountOnEnter, unmountOnExit } = props;
  if (!inProp && (mountOnEnter || unmountOnExit)) {
    return null;
  }
  return <>{children}</>;
}

export function ClickAwayListener(props: any) {
  const { children, onClickAway } = props;
  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClickAway?.(event);
        }
      }}
    >
      {children}
    </div>
  );
}

export function ThemeProvider(props: any) {
  const { theme, children } = props;
  return (
    <ThemeContext.Provider value={theme || defaultTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function CssBaseline(props: any) {
  return <>{props.children}</>;
}

export function createTheme(baseOrOptions?: any, options?: any): any {
  if (options)
    return mergeTheme(mergeTheme(defaultTheme, baseOrOptions), options);
  return mergeTheme(defaultTheme, baseOrOptions);
}

export function alpha(color: string, value: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const r = Number.parseInt(color.slice(1, 3), 16);
    const g = Number.parseInt(color.slice(3, 5), 16);
    const b = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${value})`;
  }
  return color;
}

export function darken(color: string, value: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const r = Math.max(
      0,
      Math.round(Number.parseInt(color.slice(1, 3), 16) * (1 - value)),
    );
    const g = Math.max(
      0,
      Math.round(Number.parseInt(color.slice(3, 5), 16) * (1 - value)),
    );
    const b = Math.max(
      0,
      Math.round(Number.parseInt(color.slice(5, 7), 16) * (1 - value)),
    );
    return `rgb(${r}, ${g}, ${b})`;
  }
  return color;
}

export function styled(Comp: any) {
  return (_styles: any) => {
    return function StyledComponent(props: any) {
      return <Comp {...props} />;
    };
  };
}

export default {};
