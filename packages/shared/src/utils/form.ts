import type { ChangeEvent } from "react";

export const onInputChange =
  (onChange: (value: string) => void) =>
  (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

export const onTextareaChange =
  (onChange: (value: string) => void) =>
  (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };
