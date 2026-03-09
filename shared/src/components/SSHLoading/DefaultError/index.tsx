import { Box } from "@mui/material";
import { get } from "lodash-es";
import { type ErrorProps, StatusButton } from "../common";
import ErrorText from "../ErrorText";

export default function DefaultError({ error, onClose, onRetry }: ErrorProps) {
  return (
    <>
      <ErrorText
        title={get(error, "type", "Unknown error")}
        message={get(error, "message", String(error))}
      />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <StatusButton variant="outlined" onClick={onClose}>
          Close
        </StatusButton>
        <StatusButton variant="contained" onClick={onRetry}>
          Retry
        </StatusButton>
      </Box>
    </>
  );
}
