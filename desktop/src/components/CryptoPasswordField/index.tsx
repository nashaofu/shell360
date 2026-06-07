import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { TextFieldPassword } from "shared";

interface CryptoPasswordFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  requiredMessage: string;
  matchField?: Path<T>;
}

export default function CryptoPasswordField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  requiredMessage,
  matchField,
}: CryptoPasswordFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: { value: true, message: requiredMessage },
        minLength: {
          value: 8,
          message: "Please enter at least 8 characters",
        },
        maxLength: {
          value: 128,
          message: "Please enter no more than 128 characters",
        },
        validate: matchField
          ? (value, formValues) => {
              if (value !== formValues[matchField]) {
                return "The password confirmation does not match the password";
              }
              return true;
            }
          : undefined,
      }}
      render={({ field, fieldState }) => (
        <TextFieldPassword
          {...field}
          required
          fullWidth
          label={label}
          placeholder={placeholder}
          error={fieldState.invalid}
          helperText={fieldState.error?.message}
        />
      )}
    />
  );
}
